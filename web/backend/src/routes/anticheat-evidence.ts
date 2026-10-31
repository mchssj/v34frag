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
  return c.json({ id: reg.id, already_stored: reg.already_stored }, 201);
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
