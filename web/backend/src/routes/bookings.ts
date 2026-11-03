import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { optionalUser, requireAdmin, requireModerator, requireUser } from '../lib/auth';
import { must, mustHave } from '../lib/db';
import { AppError } from '../lib/errors';
import { Envelope, boolParam, envelope, listQuery } from '../lib/list';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { bearer, errorResponses, json } from '../schemas/common';

// Iniciar partidas de torneo y PCW en un servidor libre (plan docs/bitacora/2026-11-02-iniciar-torneo-pcw, replanteo 56).
// Las reglas las valida la base; acá solo se valida la forma del pedido. La reserva se devuelve como la arma
// match_booking(), con la conexión solo para quien la puede ver.

type C = Context<AppEnv>;

const Id = z.string().uuid();
const IdParam = z.object({ id: Id.openapi({ param: { name: 'id', in: 'path' } }) });

const Booking = z
  .object({
    kind: z.enum(['official', 'pcw']),
    veto_done: z.boolean(),
    can_veto: z.boolean().openapi({ description: 'Le toca vetar a esta cuenta (capitán del equipo del turno)' }),
    veto_turn_seconds: z.number().int(),
    maps: z.array(z.string()),
    my_side: z.number().int().openapi({ description: '1 o 2 si la cuenta es de un plantel; 0 si no' }),
    can_manage: z.boolean(),
    can_start: z.boolean(),
    can_ready: z.boolean(),
    ban_until: z.string().nullable(),
    server_now: z.string().openapi({ description: 'Hora del servidor: la web corrige sus cuentas regresivas con ella' }),
    booking: z.record(z.string(), z.unknown()).nullable().openapi({ description: 'La reserva abierta o la última; null si nunca hubo' }),
  })
  .openapi('MatchBooking');

const StartBody = z
  .object({
    server_id: Id,
    wait_minutes: z.number().int().min(1).max(20).default(10).openapi({ description: 'Espera a los jugadores en cada mapa (1 a 20)' }),
  })
  .openapi('MatchStart');
const ActionBody = z
  .object({
    action: z.enum(['allow_four', 'extend', 'cancel', 'release']).openapi({
      description: '`allow_four` (un equipo empieza con 4), `extend` (más espera, hasta 20 min), `cancel` (el organizador) o `release` (moderador, aunque haya un mapa en juego)',
    }),
    side: z.union([z.literal(1), z.literal(2)]).optional(),
    minutes: z.number().int().min(1).max(20).optional(),
  })
  .openapi('MatchBookingAction');
const VetoTurnBody = z.object({ seconds: z.number().int().min(15).max(120) }).openapi('EventVetoTurn');
const FlagsBody = z
  .object({ mm_enabled: z.boolean().optional(), official_enabled: z.boolean().optional(), pcw_enabled: z.boolean().optional() })
  .refine((b) => Object.keys(b).length > 0, 'Mandá al menos una marca')
  .openapi('ServerFlags');

const FreeServer = z.object({ id: Id, name: z.string(), region: z.string().nullable() }).openapi('FreeServer');
const FreeQuery = listQuery(['name', 'region'] as const, { sort: 'name', order: 'asc' }).extend({
  kind: z.enum(['official', 'pcw', 'mm']).default('official').openapi({ description: 'Para qué: torneo, PCW o matchmaking' }),
  q: z.string().max(60).optional().openapi({ description: 'Parte del nombre' }),
  region: z.string().max(60).optional(),
});
const PcwBan = z
  .object({
    id: Id,
    team: z.object({ id: Id, name: z.string() }).nullable(),
    player: z.object({ id: Id, nick: z.string() }).nullable(),
    until: z.string(),
    reason: z.string(),
    match_id: Id.nullable(),
    created_at: z.string(),
    lifted_at: z.string().nullable(),
    active: z.boolean(),
  })
  .openapi('PcwBan');
const BanQuery = listQuery(['created_at', 'until'] as const, { sort: 'created_at', order: 'desc' }).extend({
  active: boolParam('Solo las vigentes (`true`) o las vencidas y levantadas (`false`)'),
  q: z.string().max(60).optional().openapi({ description: 'Nombre del equipo o del jugador' }),
});

const ok = (schema: z.ZodTypeAny) => ({ 200: { description: 'OK', ...json(schema) } });
const body = <T extends z.ZodTypeAny>(schema: T) => ({ body: { required: true, content: { 'application/json': { schema } } } });
const rpc = async (c: C, fn: string, args: Record<string, unknown>) => must(await c.var.sb.rpc(fn as never, args as never));
const booking = async (c: C, id: string) => {
  const b = mustHave(await c.var.sb.rpc('match_booking' as never, { p_match: id } as never));
  return c.json({ ...(b as object), server_now: new Date().toISOString() } as never, 200);
};

const getBooking = createRoute({
  method: 'get', path: '/api/v1/matches/{id}/booking', tags: ['Partidas'], security: bearer, middleware: [optionalUser] as const,
  summary: 'Servidor de una partida de torneo o PCW: la reserva, la espera, la fila y la conexión (solo planteles, streamers y staff)',
  request: { params: IdParam },
  responses: { ...ok(Booking), ...errorResponses(400, 401, 404) },
});
const start = createRoute({
  method: 'post', path: '/api/v1/matches/{id}/start', tags: ['Partidas'], security: bearer, middleware: [requireUser] as const,
  summary: 'Torneo: iniciar la partida en un servidor libre (organizador o moderador). El servidor queda ocupado en el acto',
  request: { params: IdParam, ...body(StartBody) },
  responses: { ...ok(Booking), ...errorResponses(400, 401, 403, 404, 409) },
});
const ready = createRoute({
  method: 'post', path: '/api/v1/matches/{id}/ready', tags: ['Partidas'], security: bearer, middleware: [requireUser] as const,
  summary: 'PCW: mi equipo está listo. Con los dos, arranca el veto (si falta) y después la fila de servidores',
  request: { params: IdParam },
  responses: { ...ok(Booking), ...errorResponses(400, 401, 403, 404) },
});
const unready = createRoute({
  method: 'delete', path: '/api/v1/matches/{id}/ready', tags: ['Partidas'], security: bearer, middleware: [requireUser] as const,
  summary: 'PCW: ya no estamos listos (sin sanción mientras no haya servidor asignado)',
  request: { params: IdParam },
  responses: { ...ok(Booking), ...errorResponses(400, 401, 403, 404) },
});
const act = createRoute({
  method: 'post', path: '/api/v1/matches/{id}/booking/actions', tags: ['Partidas'], security: bearer, middleware: [requireUser] as const,
  summary: 'Organizador o moderador: dejar empezar con 4, extender la espera o cancelar la reserva',
  request: { params: IdParam, ...body(ActionBody) },
  responses: { ...ok(Booking), ...errorResponses(400, 401, 403, 404) },
});
const free = createRoute({
  method: 'get', path: '/api/v1/servers/free', tags: ['Servidores'], security: bearer, middleware: [requireUser] as const,
  summary: 'Servidores libres y aptos para un torneo, una PCW o el matchmaking (organizadores y moderadores)',
  request: { query: FreeQuery },
  responses: { ...ok(Envelope(FreeServer)), ...errorResponses(400, 401, 403) },
});
const getVetoTurn = createRoute({
  method: 'get', path: '/api/v1/events/{id}/veto-turn', tags: ['Torneos'], security: bearer, middleware: [optionalUser] as const,
  summary: 'Segundos por turno del veto de un torneo',
  request: { params: IdParam },
  responses: { ...ok(VetoTurnBody), ...errorResponses(400, 404) },
});
const vetoTurn = createRoute({
  method: 'put', path: '/api/v1/events/{id}/veto-turn', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Segundos por turno del veto de un torneo (15 a 120; 30 por defecto)',
  request: { params: IdParam, ...body(VetoTurnBody) },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 403, 404) },
});
const flags = createRoute({
  method: 'patch', path: '/api/v1/admin/servers/{id}/flags', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Aptitud de un servidor: matchmaking, torneos y PCW',
  request: { params: IdParam, ...body(FlagsBody) },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 403, 404) },
});
const bans = createRoute({
  method: 'get', path: '/api/v1/admin/pcw-bans', tags: ['Admin'], security: bearer, middleware: [requireUser, requireModerator] as const,
  summary: 'Sanciones por abandonar una PCW (equipos y jugadores)',
  request: { query: BanQuery },
  responses: { ...ok(Envelope(PcwBan)), ...errorResponses(400, 401, 403) },
});
const lift = createRoute({
  method: 'delete', path: '/api/v1/admin/pcw-bans/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireModerator] as const,
  summary: 'Levantar una sanción de PCW',
  request: { params: IdParam },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 403, 404) },
});
const teamBan = createRoute({
  method: 'get', path: '/api/v1/teams/{id}/pcw-ban', tags: ['Equipos'], security: bearer, middleware: [optionalUser] as const,
  summary: 'Hasta cuándo un equipo no puede crear ni aceptar PCW (null si puede)',
  request: { params: IdParam },
  responses: { ...ok(z.object({ until: z.string().nullable() }).openapi('TeamPcwBan')), ...errorResponses(400) },
});

export const bookings = createRouter()
  .openapi(getBooking, async (c) => {
    const { id } = c.req.valid('param');
    const b = must(await c.var.sb.rpc('match_booking' as never, { p_match: id } as never));
    if (!b) throw new AppError(404, 'NOT_FOUND', 'No existe esa partida de torneo o PCW.');
    return c.json({ ...(b as object), server_now: new Date().toISOString() } as never, 200);
  })
  .openapi(start, async (c) => {
    const { id } = c.req.valid('param');
    const { server_id, wait_minutes } = c.req.valid('json');
    await rpc(c, 'match_start', { p_match: id, p_server: server_id, p_wait: wait_minutes });
    return booking(c, id);
  })
  .openapi(ready, async (c) => {
    const { id } = c.req.valid('param');
    await rpc(c, 'pcw_ready', { p_match: id, p_ready: true });
    return booking(c, id);
  })
  .openapi(unready, async (c) => {
    const { id } = c.req.valid('param');
    await rpc(c, 'pcw_ready', { p_match: id, p_ready: false });
    return booking(c, id);
  })
  .openapi(act, async (c) => {
    const { id } = c.req.valid('param');
    const { action, side, minutes } = c.req.valid('json');
    if (action === 'release') await rpc(c, 'match_booking_release', { p_match: id });
    else await rpc(c, 'match_booking_action', { p_match: id, p_action: action, p_side: side ?? null, p_minutes: minutes ?? null });
    return booking(c, id);
  })
  .openapi(free, async (c) => {
    // La base da los libres en este momento (son pocos): acá se filtran, se ordenan y se paginan.
    const p = c.req.valid('query');
    const all = (mustHave(await c.var.sb.rpc('servers_free' as never, { p_kind: p.kind } as never)) as z.infer<typeof FreeServer>[])
      .filter((s) => !p.q || s.name.toLowerCase().includes(p.q.toLowerCase()))
      .filter((s) => !p.region || s.region === p.region);
    const dir = p.order === 'asc' ? 1 : -1;
    all.sort((a, b) => dir * String(a[p.sort] ?? '').localeCompare(String(b[p.sort] ?? ''), 'es') || a.id.localeCompare(b.id));
    const from = (p.page - 1) * p.per;
    return c.json(envelope(all.slice(from, from + p.per), all.length, p), 200);
  })
  .openapi(getVetoTurn, async (c) => {
    const { id } = c.req.valid('param');
    const e = must(await c.var.sb.from('events').select('veto_turn_seconds').eq('id', id).maybeSingle()) as { veto_turn_seconds: number } | null;
    if (!e) throw new AppError(404, 'NOT_FOUND', 'No existe ese torneo.');
    return c.json({ seconds: e.veto_turn_seconds }, 200);
  })
  .openapi(vetoTurn, async (c) => {
    const { id } = c.req.valid('param');
    const { seconds } = c.req.valid('json');
    // La RLS de events deja actualizar solo a quien gestiona el torneo.
    const rows = must(await c.var.sb.from('events').update({ veto_turn_seconds: seconds } as never).eq('id', id).select('id')) as unknown[];
    if (!rows?.length) throw new AppError(404, 'NOT_FOUND', 'No existe ese torneo o no lo gestionás.');
    return c.body(null, 204);
  })
  .openapi(flags, async (c) => {
    const { id } = c.req.valid('param');
    const b = c.req.valid('json');
    await rpc(c, 'server_set_flags', { p_server: id, p_mm: b.mm_enabled ?? null, p_official: b.official_enabled ?? null, p_pcw: b.pcw_enabled ?? null });
    return c.body(null, 204);
  })
  .openapi(bans, async (c) => {
    const p = c.req.valid('query');
    const r = mustHave(await c.var.sb.rpc('admin_pcw_bans' as never, {
      p_active: p.active ?? null, p_q: p.q ?? null, p_sort: p.sort, p_order: p.order, p_page: p.page, p_per: p.per,
    } as never)) as { items: z.infer<typeof PcwBan>[]; total: number };
    return c.json(envelope(r.items, r.total, p), 200);
  })
  .openapi(lift, async (c) => {
    const { id } = c.req.valid('param');
    await rpc(c, 'pcw_ban_lift', { p_ban: id });
    return c.body(null, 204);
  })
  .openapi(teamBan, async (c) => {
    const { id } = c.req.valid('param');
    const until = must(await c.var.sb.rpc('team_pcw_ban_until' as never, { p_team: id } as never)) as string | null;
    return c.json({ until: until ?? null }, 200);
  });
