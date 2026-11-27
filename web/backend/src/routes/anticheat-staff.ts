import { createRoute, z } from '@hono/zod-openapi';
import { requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave, notFound } from '../lib/db';
import { createRouter } from '../lib/router';
import { IdParam } from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';
import { Envelope, envelope, listQuery } from '../lib/list';

// Anticheat, panel del staff (plan docs/bitacora/2026-11-27-anticheat-deteccion, replanteos 156 y 157): marcas, buscar un hash,
// firmas, configuración del agente y ban por máquina. Solo admins (ac_can_review), y cada lectura queda en ac_admin_actions.


const Kinds = z.enum(['inventory', 'start', 'end', 'module', 'handle', 'overlay', 'driver', 'game_file']);
const Sha = z.string().regex(/^[0-9a-f]{64}$/, 'SHA-256 en minúsculas');

const FlagQuery = z.object({
  open: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  min_severity: z.coerce.number().int().min(1).max(3).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const Flag = z
  .object({
    id: z.number().int(),
    session_id: z.uuid(),
    rule: z.string(),
    severity: z.number().int(),
    detail: z.record(z.string(), z.unknown()),
    created_at: z.string(),
    reviewed_at: z.string().nullable(),
    review_note: z.string().nullable(),
    player_id: z.uuid().optional(),
    nick: z.string().optional(),
    steam_id: z.string().optional(),
    server_name: z.string().optional(),
    started_at: z.string().optional(),
    status: z.string().optional(),
  })
  .openapi('AcFlag');
const FlagId = z.object({ id: z.coerce.number().int().positive() });
const ReviewBody = z.object({ note: z.string().trim().max(300).optional() }).openapi('AcFlagReview');

const HashParam = z.object({ sha256: Sha });
const HashResult = z
  .object({
    players: z.number().int(),
    items: z.array(z.record(z.string(), z.unknown())),
    signature: z.record(z.string(), z.unknown()).nullable(),
  })
  .openapi('AcHashSearch');

const Signature = z
  .object({
    id: z.uuid(),
    sha256: z.string().nullable(),
    name: z.string().nullable(),
    kinds: z.array(z.string()).nullable(),
    verdict: z.enum(['bad', 'good']),
    label: z.string(),
    created_at: z.string(),
  })
  .openapi('AcSignature');
const SignatureBody = z
  .object({
    sha256: Sha.optional(),
    name: z.string().trim().min(1).max(260).optional(),
    kinds: z.array(Kinds).min(1).max(8).optional(),
    verdict: z.enum(['bad', 'good']),
    label: z.string().trim().min(1).max(120),
  })
  .refine((b) => b.sha256 || b.name, 'Hace falta el hash o el nombre')
  .openapi('AcSignatureBody');

const AgentConfig = z
  .object({
    agent_config: z.record(z.string(), z.unknown()),
    agent_latest: z.object({ version: z.string(), url: z.string(), sha256: z.string() }).nullable(),
    agent_min_version: z.string().nullable(),
    agent_hashes: z.array(z.string()),
    capture_min_s: z.number().int(),
    capture_max_s: z.number().int(),
    screenshot_retention_days: z.number().int(),
    retention_days: z.number().int(),
  })
  .openapi('AcAgentConfig');
const AgentConfigBody = z
  .object({
    agent_config: z
      .object({
        handles: z.boolean(),
        overlays: z.boolean(),
        drivers: z.boolean(),
        game_files: z.boolean(),
        handles_every: z.number().int().min(3).max(300),
        overlays_every: z.number().int().min(2).max(300),
        modules_every: z.number().int().min(2).max(300),
        files: z.array(z.string().max(260).regex(/^[^.][^:]*$/, 'Relativo a la carpeta del juego')).max(32),
      })
      .partial()
      .optional(),
    // Solo una URL de cmleague.lat: el agente no baja nada de otro lado.
    agent_latest: z
      .object({ version: z.string().regex(/^\d+\.\d+\.\d+$/), url: z.url().regex(/^https:\/\/([a-z0-9-]+\.)*cmleague\.lat\//), sha256: Sha })
      .nullable()
      .optional(),
    agent_min_version: z.string().regex(/^\d+\.\d+\.\d+$/).or(z.literal('')).optional(),
    agent_hashes: z.array(Sha).max(20).optional(),
    capture_min_s: z.number().int().min(30).max(3600).optional(),
    capture_max_s: z.number().int().min(30).max(3600).optional(),
    screenshot_retention_days: z.number().int().min(1).max(365).optional(),
    retention_days: z.number().int().min(1).max(365).optional(),
  })
  .refine((b) => b.capture_min_s === undefined || b.capture_max_s === undefined || b.capture_min_s <= b.capture_max_s, 'El mínimo va antes que el máximo')
  .openapi('AcAgentConfigBody');

// El modo de cada servidor (replanteo 159): off no protege y always lo exige desde que el jugador entra. mixes (con la partida
// en vivo, cml_ac_mix 1) ya no se elige (Daniel, 2026-11-27: quien entra sin el anticheat juega el calentamiento y lo expulsan
// al arrancar el mix). Se sigue listando y filtrando si un servidor ya lo tiene.
const ServerMode = z.enum(['off', 'mixes', 'always']).openapi({ description: '`off`, `always` o `mixes` (ya no se elige)' });
const SettableMode = z.enum(['off', 'always']).openapi({ description: '`off` o `always`' });
const ServerPolicy = z
  .object({ server_id: z.uuid(), name: z.string(), mode: ServerMode, updated_at: z.string().nullable() })
  .openapi('AcServerPolicy');
const ServerQuery = listQuery(['name', 'mode', 'updated_at'] as const, { sort: 'name', order: 'asc' }).extend({
  q: z.string().trim().max(64).optional().openapi({ description: 'Parte del nombre del servidor' }),
  mode: ServerMode.optional(),
});
const ServerModeBody = z.object({ mode: SettableMode }).openapi('AcServerModeBody');

const BanMachineBody = z.object({ reason: z.string().trim().min(3).max(200) }).openapi('AcBanMachineBody');
const LiftBody = z.object({ reason: z.string().trim().max(200).optional() }).openapi('AcLiftMachineBody');
const ExceptionBody = z.object({ user_id: z.uuid(), note: z.string().trim().max(200).optional() }).openapi('AcMachineExceptionBody');
const Machine = z
  .object({
    machine_id: z.uuid().nullable(),
    banned: z.boolean(),
    bans: z.array(z.record(z.string(), z.unknown())),
    accounts: z.array(z.record(z.string(), z.unknown())),
    attempts: z.array(z.record(z.string(), z.unknown())),
    exceptions: z.array(z.record(z.string(), z.unknown())),
  })
  .openapi('AcMachine');

const flags = createRoute({
  method: 'get', path: '/api/v1/admin/anticheat/flags', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Marcas del anticheat',
  description: 'Las más graves primero. Son hechos observados, no conclusiones.',
  request: { query: FlagQuery },
  responses: { 200: { description: 'Marcas', ...json(z.object({ items: z.array(Flag) })) }, ...errorResponses(400, 401, 403) },
});
const review = createRoute({
  method: 'post', path: '/api/v1/admin/anticheat/flags/{id}/review', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Dar una marca por revisada',
  request: { params: FlagId, body: { required: false, ...json(ReviewBody) } },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 403) },
});
const hash = createRoute({
  method: 'get', path: '/api/v1/admin/anticheat/hash/{sha256}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Buscar un hash entre todos los jugadores',
  request: { params: HashParam },
  responses: { 200: { description: 'Dónde apareció', ...json(HashResult) }, ...errorResponses(400, 401, 403) },
});
const signatures = createRoute({
  method: 'get', path: '/api/v1/admin/anticheat/signatures', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Firmas: trampas (bad) y programas conocidos (good)',
  responses: { 200: { description: 'Firmas', ...json(z.object({ items: z.array(Signature) })) }, ...errorResponses(401, 403) },
});
const signatureAdd = createRoute({
  method: 'post', path: '/api/v1/admin/anticheat/signatures', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cargar una firma',
  description: 'Nunca viaja al agente: la compara la base con cada evento.',
  request: { body: { required: true, ...json(SignatureBody) } },
  responses: { 201: { description: 'Cargada', ...json(z.object({ id: z.uuid() })) }, ...errorResponses(400, 401, 403) },
});
const signatureRemove = createRoute({
  method: 'delete', path: '/api/v1/admin/anticheat/signatures/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Borrar una firma',
  request: { params: IdParam },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 403) },
});
const config = createRoute({
  method: 'get', path: '/api/v1/admin/anticheat/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Configuración del agente',
  responses: { 200: { description: 'Configuración', ...json(AgentConfig) }, ...errorResponses(401, 403) },
});
const configSet = createRoute({
  method: 'patch', path: '/api/v1/admin/anticheat/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar la configuración del agente',
  description: 'Solo cambia lo que viene. Llega a los agentes en el próximo latido. Queda registrado.',
  request: { body: { required: true, ...json(AgentConfigBody) } },
  responses: { 200: { description: 'Configuración', ...json(AgentConfig) }, ...errorResponses(400, 401, 403) },
});
const machine = createRoute({
  method: 'get', path: '/api/v1/admin/anticheat/sessions/{id}/machine', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'La máquina de una sesión: cuentas, baneos e intentos',
  request: { params: IdParam },
  responses: { 200: { description: 'Máquina', ...json(Machine) }, ...errorResponses(400, 401, 403, 404) },
});
const banMachine = createRoute({
  method: 'post', path: '/api/v1/admin/anticheat/sessions/{id}/ban-machine', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Banear la máquina de una sesión',
  description: 'Desde ahí, esa máquina no puede vincular el agente, y una cuenta que lo intente queda baneada por evasión.',
  request: { params: IdParam, body: { required: true, ...json(BanMachineBody) } },
  responses: { 200: { description: 'Baneada', ...json(z.object({ id: z.uuid() })) }, ...errorResponses(400, 401, 403, 404) },
});
const liftMachine = createRoute({
  method: 'post', path: '/api/v1/admin/anticheat/machine-bans/{id}/lift', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Levantar el ban de una máquina',
  request: { params: IdParam, body: { required: false, ...json(LiftBody) } },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 403) },
});
const exception = createRoute({
  method: 'post', path: '/api/v1/admin/anticheat/sessions/{id}/machine-exception', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'PC compartida: dejar jugar a una cuenta en esa máquina',
  request: { params: IdParam, body: { required: true, ...json(ExceptionBody) } },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 403) },
});

const servers = createRoute({
  method: 'get', path: '/api/v1/admin/anticheat/servers', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Servidores activos y si exigen el anticheat',
  request: { query: ServerQuery },
  responses: { 200: { description: 'Servidores', ...json(Envelope(ServerPolicy)) }, ...errorResponses(400, 401, 403) },
});
const serverSet = createRoute({
  method: 'put', path: '/api/v1/admin/anticheat/servers/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar cuándo exige el anticheat un servidor',
  description: 'Lo toma el Bridge en la próxima revisión (al entrar y cada minuto). Queda registrado.',
  request: { params: IdParam, body: { required: true, ...json(ServerModeBody) } },
  responses: { 200: { description: 'Servidor', ...json(ServerPolicy) }, ...errorResponses(400, 401, 403, 404) },
});

export const anticheatStaff = createRouter();

anticheatStaff.openapi(servers, async (c) => {
  const q = c.req.valid('query');
  const r = mustHave(
    await c.var.sb.rpc('ac_admin_server_policies', {
      ...(q.q ? { p_q: q.q } : {}), ...(q.mode ? { p_mode: q.mode } : {}),
      p_sort: q.sort, p_order: q.order, p_limit: q.per, p_offset: (q.page - 1) * q.per,
    } as never),
  ) as { items: z.infer<typeof ServerPolicy>[]; total: number };
  return c.json(envelope(r.items, r.total, q), 200);
});

anticheatStaff.openapi(serverSet, async (c) => {
  const r = mustHave(await c.var.sb.rpc('ac_admin_set_server_policy', { p_server: c.req.valid('param').id, p_mode: c.req.valid('json').mode } as never));
  return c.json(r as never, 200);
});

anticheatStaff.openapi(flags, async (c) => {
  const q = c.req.valid('query');
  const items = mustHave(await c.var.sb.rpc('ac_admin_flags', { p_open: q.open, p_min_severity: q.min_severity, p_limit: q.limit, p_offset: q.offset }));
  return c.json({ items: items as never[] }, 200);
});

anticheatStaff.openapi(review, async (c) => {
  const note = c.req.valid('json')?.note;
  must(await c.var.sb.rpc('ac_admin_flag_review', { p_flag: c.req.valid('param').id, ...(note ? { p_note: note } : {}) }));
  return c.body(null, 204);
});

anticheatStaff.openapi(hash, async (c) => {
  const r = mustHave(await c.var.sb.rpc('ac_admin_hash_search', { p_sha256: c.req.valid('param').sha256 }));
  return c.json(r as never, 200);
});

anticheatStaff.openapi(signatures, async (c) => {
  const items = mustHave(await c.var.sb.rpc('ac_admin_signatures'));
  return c.json({ items: items as never[] }, 200);
});

anticheatStaff.openapi(signatureAdd, async (c) => {
  const b = c.req.valid('json');
  const id = mustHave(
    await c.var.sb.rpc('ac_admin_signature_add', {
      p_sha256: b.sha256 ?? '', p_name: b.name ?? '', p_kinds: (b.kinds ?? null) as never, p_verdict: b.verdict, p_label: b.label,
    }),
  );
  return c.json({ id: id as string }, 201);
});

anticheatStaff.openapi(signatureRemove, async (c) => {
  must(await c.var.sb.rpc('ac_admin_signature_remove', { p_id: c.req.valid('param').id }));
  return c.body(null, 204);
});

anticheatStaff.openapi(config, async (c) => {
  const r = mustHave(await c.var.sb.rpc('ac_admin_agent_config'));
  return c.json(r as never, 200);
});

anticheatStaff.openapi(configSet, async (c) => {
  const b = c.req.valid('json');
  // agent_config se guarda entero: se completa con lo que ya había.
  let body: Record<string, unknown> = { ...b };
  if (b.agent_config) {
    const cur = mustHave(await c.var.sb.rpc('ac_admin_agent_config')) as { agent_config: Record<string, unknown> };
    body = { ...body, agent_config: { ...cur.agent_config, ...b.agent_config } };
  }
  const r = mustHave(await c.var.sb.rpc('ac_admin_set_agent_config', { p: body as never }));
  return c.json(r as never, 200);
});

anticheatStaff.openapi(machine, async (c) => {
  const r = must(await c.var.sb.rpc('ac_admin_machine_accounts', { p_session: c.req.valid('param').id }));
  if (!r) throw notFound('esa sesión');
  return c.json(r as never, 200);
});

anticheatStaff.openapi(banMachine, async (c) => {
  const r = must(await c.var.sb.rpc('ac_admin_ban_machine', { p_session: c.req.valid('param').id, p_reason: c.req.valid('json').reason }));
  if (!r) throw notFound('esa sesión');
  return c.json(r as never, 200);
});

anticheatStaff.openapi(liftMachine, async (c) => {
  const reason = c.req.valid('json')?.reason;
  must(await c.var.sb.rpc('ac_admin_lift_machine', { p_ban: c.req.valid('param').id, ...(reason ? { p_reason: reason } : {}) }));
  return c.body(null, 204);
});

anticheatStaff.openapi(exception, async (c) => {
  const b = c.req.valid('json');
  must(await c.var.sb.rpc('ac_admin_machine_exception', { p_session: c.req.valid('param').id, p_user: b.user_id, ...(b.note ? { p_note: b.note } : {}) }));
  return c.body(null, 204);
});
