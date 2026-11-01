import { createRoute, z } from '@hono/zod-openapi';
import { createClient } from '@supabase/supabase-js';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave, notFound } from '../lib/db';
import { AppError } from '../lib/errors';
import { createRouter } from '../lib/router';
import { anonClient } from '../lib/supabase';
import type { AppEnv } from '../lib/types';
import { IdParam } from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';

// Anticheat FRAG, procesos y capturas (plan docs/bitacora/2026-10-30-anticheat-evidencia, replanteo 40). La API recalcula el SHA-256
// y comprueba que sea un JPEG. La clave de servicio se usa solo para subir al bucket privado: nunca llega al agente ni a la web.

type C = Context<AppEnv>;
const MAX_JPEG = 5 * 1024 * 1024;

const ProcessEvent = z.object({
  client_id: z.string().min(1).max(64),
  kind: z.enum(['inventory', 'start', 'end']),
  pid: z.number().int(),
  name: z.string().max(260),
  path: z.string().max(1024).optional(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  signature: z.enum(['valid', 'unsigned', 'invalid', 'unknown']).optional(),
  publisher: z.string().max(200).optional(),
  note: z.string().max(64).optional(),
  started_at: z.iso.datetime().optional(),
  observed_at: z.iso.datetime(),
});
const ProcessBatch = z.object({ session_id: z.uuid(), events: z.array(ProcessEvent).min(1).max(500) }).openapi('AcProcessBatch');
const ProcessResult = z.object({ accepted: z.number().int(), rejected: z.number().int() }).openapi('AcProcessResult');

const ScreenshotQuery = z.object({
  session_id: z.uuid(),
  client_id: z.string().min(1).max(64),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  width: z.coerce.number().int().min(1).max(16384),
  height: z.coerce.number().int().min(1).max(16384),
  method: z.enum(['desktop_duplication', 'bitblt_screen']),
  kind: z.enum(['auto', 'manual']),
  request_id: z.uuid().optional(),
  taken_at: z.iso.datetime(),
});
const ScreenshotResult = z.object({ id: z.uuid(), already_stored: z.boolean() }).openapi('AcScreenshotResult');

const ResultBody = z.object({ result: z.enum(['not_foreground', 'failed']) }).openapi('AcCaptureResult');
const CaptureBody = z.object({ reason: z.string().trim().min(3).max(200) }).openapi('AcCaptureBody');
const CaptureCreated = z.object({ id: z.uuid() }).openapi('AcCaptureCreated');

const Evidence = z
  .object({
    screenshots: z.array(z.object({
      id: z.uuid(), kind: z.string(), method: z.string(), sha256: z.string(), size_bytes: z.number().int(), width: z.number().int(), height: z.number().int(),
      taken_at: z.string(), stored_at: z.string().nullable(), request_id: z.string().nullable(), url: z.string().nullable(),
    })),
    processes: z.array(z.object({
      kind: z.string(), pid: z.number().int(), name: z.string(), path: z.string().nullable(), sha256: z.string().nullable(), signature: z.string().nullable(),
      publisher: z.string().nullable(), note: z.string().nullable(), started_at: z.string().nullable(), observed_at: z.string(),
    })),
    requests: z.array(z.object({ id: z.uuid(), reason: z.string(), status: z.string(), created_at: z.string(), resolved_at: z.string().nullable() })),
  })
  .openapi('AcEvidence');

const secret = (c: C) => {
  const s = c.var.config.AC_API_SECRET;
  if (!s) throw new AppError(501, 'NOT_AVAILABLE', 'El anticheat no está configurado en este servidor.');
  return s;
};
const agentToken = (c: C) => {
  const t = c.req.header('X-Agent-Token')?.trim();
  if (!t) throw new AppError(401, 'UNAUTHORIZED', 'El token del agente no es válido o venció.');
  return t;
};
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

const ZERO = '0'.repeat(64);
const sha256Hex = async (d: string | ArrayBuffer) => hex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? new TextEncoder().encode(d) : d));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

/** Firma ECDSA P-256 del equipo sobre el texto de la entrada. Una clave o firma mal formada no valida. */
async function signatureOk(publicKey: string, signature: string, entry: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('raw', fromB64(publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromB64(signature), new TextEncoder().encode(entry));
  } catch {
    return false;
  }
}

// v1|sesión|posición|tipo|hash del contenido|hash de la entrada anterior|fecha
type Entry = { session: string; seq: number; kind: string; item: string; prev: string };
function parseEntry(entry: string): Entry | null {
  const p = entry.split('|');
  if (p.length !== 7 || p[0] !== 'v1' || !/^\d{1,9}$/.test(p[2]!) || Number(p[2]) < 1) return null;
  if (!/^[0-9a-f]{64}$/.test(p[4]!) || !/^[0-9a-f]{64}$/.test(p[5]!)) return null;
  return { session: p[1]!, seq: Number(p[2]), kind: p[3]!, item: p[4]!, prev: p[5]! };
}

/** Agrega la evidencia a la cadena, si vino firmada. Sin firma se acepta, y la verificación la marcará incompleta. */
async function appendChain(c: C, session: string, kind: 'processes' | 'screenshot', itemSha: string, raw: string | null, ref: string | null) {
  const entry = c.req.header('X-AC-Entry');
  const signature = c.req.header('X-AC-Sig');
  if (!entry || !signature) return;
  const sb = anonClient(c.var.config);
  const access = agentToken(c);
  const reject = async (problem: string) => {
    must(await sb.rpc('ac_integrity_reject', { p_secret: secret(c), p_access: access, p_session: session, p_problem: problem }));
    throw new AppError(400, 'BUSINESS_RULE', 'La firma de la evidencia no es válida.');
  };
  const parsed = parseEntry(entry);
  if (!parsed || parsed.session !== session || parsed.kind !== kind || parsed.item !== itemSha) return reject('entry_mismatch');
  const key = must(await sb.rpc('ac_device_key', { p_secret: secret(c), p_access: access })) as string | null;
  if (!key) return reject('no_public_key');
  if (!(await signatureOk(key, signature, entry))) return reject('bad_signature');
  must(await sb.rpc('ac_evidence_append', {
    p_secret: secret(c), p_access: access, p_session: session, p_seq: parsed.seq, p_kind: kind, p_item_sha: itemSha, p_prev: parsed.prev,
    p_entry: entry, p_entry_hash: await sha256Hex(entry), p_signature: signature, ...(raw !== null ? { p_raw: raw } : {}), ...(ref ? { p_ref: ref } : {}),
  } as never));
}

const KeyBody = z.object({ public_key: z.string().regex(/^[A-Za-z0-9+/=]{20,256}$/) }).openapi('AcKeyBody');
const HoldBody = z.object({ held: z.boolean() }).openapi('AcHoldBody');
const Integrity = z
  .object({
    result: z.enum(['verified', 'failed', 'incomplete']),
    checked: z.number().int(),
    problems: z.array(z.object({ seq: z.number().int().nullable(), problem: z.string() })),
    origin: z.literal('not_verifiable').openapi({ description: 'El equipo es del jugador: se prueba que nada cambió desde el envío, no que sea verdad.' }),
  })
  .openapi('AcIntegrity');

const setKey = createRoute({
  method: 'post', path: '/api/v1/anticheat/key', tags: ['Anticheat'],
  summary: 'Registrar la clave del equipo',
  description: 'Con `X-Agent-Token`. Se fija una sola vez: otra clave da `409` y exige volver a vincular.',
  request: { body: { required: true, ...json(KeyBody) } },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 403, 409) },
});
const verify = createRoute({
  method: 'post', path: '/api/v1/admin/anticheat/sessions/{id}/verify', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Verificar la integridad de una sesión',
  description: 'Recalcula firmas, cadena, hashes y archivos, y registra el resultado. `verified` significa que nada cambió desde el envío; el origen sigue sin ser verificable.',
  request: { params: IdParam },
  responses: { 200: { description: 'Resultado', ...json(Integrity) }, ...errorResponses(400, 401, 403, 404) },
});
const hold = createRoute({
  method: 'post', path: '/api/v1/admin/anticheat/sessions/{id}/hold', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Conservar una sesión',
  description: 'Con un caso abierto, la evidencia no vence a los 30 días. Queda registrado.',
  request: { params: IdParam, body: { required: true, ...json(HoldBody) } },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 403) },
});

const processes = createRoute({
  method: 'post', path: '/api/v1/anticheat/processes', tags: ['Anticheat'],
  summary: 'Eventos de procesos',
  description: 'Con `X-Agent-Token`. Idempotente por `client_id`. Se rechaza lo observado fuera de una sesión del equipo.',
  request: { body: { required: true, ...json(ProcessBatch) } },
  responses: { 200: { description: 'Resultado', ...json(ProcessResult) }, ...errorResponses(400, 401, 403) },
});
const screenshot = createRoute({
  method: 'post', path: '/api/v1/anticheat/screenshots', tags: ['Anticheat'],
  middleware: [bodyLimit({ maxSize: MAX_JPEG, onError: () => { throw new AppError(413, 'FILE_TOO_LARGE', 'La captura supera los 5 MB.'); } })] as const,
  summary: 'Subir una captura',
  description: 'Con `X-Agent-Token`. El cuerpo es el JPEG. Idempotente por `client_id`. Si el SHA-256 no coincide con el del archivo: `400`.',
  request: { query: ScreenshotQuery },
  responses: { 201: { description: 'Guardada', ...json(ScreenshotResult) }, ...errorResponses(400, 401, 403) },
});
const requestResult = createRoute({
  method: 'post', path: '/api/v1/anticheat/requests/{id}/result', tags: ['Anticheat'],
  summary: 'La captura pedida no se pudo tomar',
  request: { params: IdParam, body: { required: true, ...json(ResultBody) } },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 403) },
});
const requestCapture = createRoute({
  method: 'post', path: '/api/v1/admin/anticheat/sessions/{id}/capture', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Pedir una captura',
  description: 'El jugador ve el aviso en la aplicación y queda registrado. Una por minuto por sesión. Solo de la ventana del juego y con el juego al frente.',
  request: { params: IdParam, body: { required: true, ...json(CaptureBody) } },
  responses: { 201: { description: 'Pedida', ...json(CaptureCreated) }, ...errorResponses(400, 401, 403) },
});
const evidence = createRoute({
  method: 'get', path: '/api/v1/admin/anticheat/sessions/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Evidencia de una sesión',
  description: 'Hechos observados, no conclusiones. Cada lectura queda registrada. Las URL de las capturas duran 5 minutos.',
  request: { params: IdParam },
  responses: { 200: { description: 'Evidencia', ...json(Evidence) }, ...errorResponses(400, 401, 403, 404) },
});

export const anticheatEvidence = createRouter();

anticheatEvidence.openapi(processes, async (c) => {
  const b = c.req.valid('json');
  const sb = anonClient(c.var.config);
  const r = mustHave(await sb.rpc('ac_ingest_processes', { p_secret: secret(c), p_access: agentToken(c), p_session: b.session_id, p_events: b.events }));
  const raw = await c.req.text();
  await appendChain(c, b.session_id, 'processes', await sha256Hex(raw), raw, null);
  return c.json(r as { accepted: number; rejected: number }, 200);
});

anticheatEvidence.openapi(screenshot, async (c) => {
  const q = c.req.valid('query');
  const key = c.var.config.SUPABASE_SERVICE_KEY;
  if (!key) throw new AppError(501, 'NOT_AVAILABLE', 'Las capturas no están configuradas en este servidor.');
  const buf = await c.req.arrayBuffer();
  const b = new Uint8Array(buf);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) throw new AppError(400, 'INVALID_FILE', 'La captura no es un JPEG.');
  if (hex(await crypto.subtle.digest('SHA-256', buf)) !== q.sha256) throw new AppError(400, 'INVALID_FILE', 'El SHA-256 no coincide con el archivo.');

  const sb = anonClient(c.var.config);
  const reg = mustHave(
    await sb.rpc('ac_screenshot_register', {
      p_secret: secret(c), p_access: agentToken(c), p_session: q.session_id, p_client_id: q.client_id, p_sha256: q.sha256, p_size: b.length,
      p_width: q.width, p_height: q.height, p_method: q.method, p_kind: q.kind, p_taken: q.taken_at, ...(q.request_id ? { p_request: q.request_id } : {}),
    } as never),
  ) as { id: string; storage_path: string; already_stored: boolean };
  if (!reg.already_stored) {
    const admin = createClient(c.var.config.SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const up = await admin.storage.from('ac-evidence').upload(reg.storage_path, b, { contentType: 'image/jpeg', upsert: true });
    if (up.error) throw new AppError(500, 'INTERNAL', 'No se pudo guardar la captura.');
    must(await sb.rpc('ac_screenshot_stored', { p_secret: secret(c), p_access: agentToken(c), p_id: reg.id }));
  }
  await appendChain(c, q.session_id, 'screenshot', q.sha256, null, reg.id);
  return c.json({ id: reg.id, already_stored: reg.already_stored }, 201);
});

anticheatEvidence.openapi(setKey, async (c) => {
  const sb = anonClient(c.var.config);
  const ok = must(await sb.rpc('ac_device_set_key', { p_secret: secret(c), p_access: agentToken(c), p_key: c.req.valid('json').public_key }));
  if (!ok) throw new AppError(409, 'CONFLICT', 'Este equipo ya tiene otra clave: hay que volver a vincularlo.');
  return c.body(null, 204);
});

anticheatEvidence.openapi(hold, async (c) => {
  must(await c.var.sb.rpc('ac_admin_hold', { p_session: c.req.valid('param').id, p_held: c.req.valid('json').held }));
  return c.body(null, 204);
});

anticheatEvidence.openapi(verify, async (c) => {
  const id = c.req.valid('param').id;
  type Row = { seq: number; kind: string; item_sha: string; prev_hash: string; entry: string; entry_hash: string; signature: string; raw: string | null; ref_id: string | null };
  const chain = must(await c.var.sb.rpc('ac_admin_chain', { p_session: id })) as {
    public_key: string | null; entries: Row[];
    screenshots: { id: string; sha256: string; storage_path: string; stored: boolean }[];
    processes: { client_id: string; name: string; path: string | null; sha256: string | null }[];
  } | null;
  if (!chain) throw notFound('esa sesión');

  const failed: { seq: number | null; problem: string }[] = [];
  const missing: { seq: number | null; problem: string }[] = [];
  if (!chain.public_key) missing.push({ seq: null, problem: 'no_public_key' });
  if (chain.entries.length === 0) missing.push({ seq: null, problem: 'no_entries' });
  const shots = new Map(chain.screenshots.map((s) => [s.id, s]));
  const rows = new Map(chain.processes.map((p) => [p.client_id, p]));
  const seenShots = new Set<string>();
  const seenRows = new Set<string>();
  const hashes = new Map(chain.entries.map((e) => [e.seq, e.entry_hash]));

  for (const e of chain.entries) {
    const bad = (problem: string) => failed.push({ seq: e.seq, problem });
    const parsed = parseEntry(e.entry);
    if (!parsed || parsed.session !== id || parsed.kind !== e.kind || parsed.item !== e.item_sha || parsed.prev !== e.prev_hash || parsed.seq !== e.seq) bad('entry_modified');
    if ((await sha256Hex(e.entry)) !== e.entry_hash) bad('entry_modified');
    if (chain.public_key && !(await signatureOk(chain.public_key, e.signature, e.entry))) bad('bad_signature');
    if (e.seq === 1 ? e.prev_hash !== ZERO : hashes.has(e.seq - 1) && hashes.get(e.seq - 1) !== e.prev_hash) bad('chain_broken');
    if (e.seq > 1 && !hashes.has(e.seq - 1)) missing.push({ seq: e.seq - 1, problem: 'missing_entry' });

    if (e.kind === 'processes') {
      if (e.raw === null || (await sha256Hex(e.raw)) !== e.item_sha) { bad('content_modified'); continue; }
      const batch = JSON.parse(e.raw) as { events: { client_id: string; name: string; path?: string; sha256?: string }[] };
      for (const ev of batch.events) {
        const row = rows.get(ev.client_id);
        seenRows.add(ev.client_id);
        if (!row) bad('process_deleted');
        else if (row.name !== ev.name || (row.path ?? undefined) !== ev.path || (row.sha256 ?? undefined) !== ev.sha256) bad('process_modified');
      }
    } else {
      const shot = e.ref_id ? shots.get(e.ref_id) : undefined;
      if (e.ref_id) seenShots.add(e.ref_id);
      if (!shot) { bad('screenshot_deleted'); continue; }
      if (shot.sha256 !== e.item_sha) bad('screenshot_modified');
      const file = await c.var.sb.storage.from('ac-evidence').download(shot.storage_path);
      if (file.error || !file.data) bad('file_missing');
      else if ((await sha256Hex(await file.data.arrayBuffer())) !== e.item_sha) bad('file_modified');
    }
  }
  // Lo que apareció sin estar en la cadena no se puede dar por bueno.
  if (chain.processes.some((p) => !seenRows.has(p.client_id))) missing.push({ seq: null, problem: 'process_not_in_chain' });
  if (chain.screenshots.some((s) => !seenShots.has(s.id))) missing.push({ seq: null, problem: 'screenshot_not_in_chain' });

  const problems = [...failed, ...missing].slice(0, 100);
  const result = failed.length ? 'failed' : missing.length ? 'incomplete' : 'verified';
  must(await c.var.sb.rpc('ac_admin_record_integrity', { p_session: id, p_result: result, p_detail: problems }));
  return c.json({ result, checked: chain.entries.length, problems, origin: 'not_verifiable' as const }, 200);
});

anticheatEvidence.openapi(requestResult, async (c) => {
  const sb = anonClient(c.var.config);
  must(await sb.rpc('ac_capture_result', { p_secret: secret(c), p_access: agentToken(c), p_request: c.req.valid('param').id, p_result: c.req.valid('json').result }));
  return c.body(null, 204);
});

anticheatEvidence.openapi(requestCapture, async (c) => {
  const id = mustHave(await c.var.sb.rpc('ac_admin_request_capture', { p_session: c.req.valid('param').id, p_reason: c.req.valid('json').reason }));
  return c.json({ id: id as string }, 201);
});

anticheatEvidence.openapi(evidence, async (c) => {
  const r = must(await c.var.sb.rpc('ac_admin_session_evidence', { p_session: c.req.valid('param').id })) as {
    screenshots: { storage_path: string; stored_at: string | null }[]; processes: never[]; requests: never[];
  } | null;
  if (!r) throw notFound('esa sesión');
  // Firma con el token del admin: la política del bucket es la que decide.
  const screenshots = await Promise.all(
    r.screenshots.map(async ({ storage_path, ...s }) => {
      const signed = s.stored_at ? await c.var.sb.storage.from('ac-evidence').createSignedUrl(storage_path, 300) : null;
      return { ...s, url: signed?.data?.signedUrl ?? null };
    }),
  );
  return c.json({ screenshots: screenshots as never[], processes: r.processes, requests: r.requests }, 200);
});
