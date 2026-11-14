import { createRoute, type z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { isSupport, optionalUser, requireModerator, requireSupport, requireUser, userRole } from '../lib/auth';
import { AppError } from '../lib/errors';
import { must, mustHave, notFound, searchTerm } from '../lib/db';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import {
  Ban, BanCreate, BanIdParam, BanLift, BanList, BanPatch, BanQuery, PlayerBanQuery, SupportActionList, SupportActionQuery, SupportQuota,
  SupportQuotaQuery,
} from '../schemas/bans';
import { bearer, errorResponses, json } from '../schemas/common';
import { IdParam } from '../schemas/players';
import { BAN_FIELDS, type BanRow, toBan } from '../services/bans';
import { resolvePlayer } from '../services/players';

// Baneos de los servidores gestionados desde la web (plan docs/bitacora/2026-10-25-baneos-web, replanteo 31).
// La base valida los permisos (ban_create, ban_update, ban_lift): permanente solo un admin; un moderador cambia o
// levanta cualquier baneo que no sea permanente. El soporte (replanteo 117) banea por minutos, de 1 a 120, no a quien ya
// está baneado, hasta 3 veces por jugador en 7 días, y solo cambia o levanta los suyos.

type C = Context<AppEnv>;

const list = createRoute({
  method: 'get', path: '/api/v1/bans', tags: ['Baneos'], middleware: [optionalUser] as const,
  summary: 'Baneos',
  description:
    'Lista pública de los baneos de todos los servidores (también los vencidos y levantados). Sin sesión. El SteamID de un baneo ' +
    'con ficha solo lo ven moderadores y admins.',
  request: { query: BanQuery },
  responses: { 200: { description: 'Baneos', ...json(BanList) }, ...errorResponses(400, 401) },
});
const playerBans = createRoute({
  method: 'get', path: '/api/v1/players/{id}/bans', tags: ['Jugadores'], middleware: [optionalUser] as const,
  summary: 'Baneos de un jugador',
  description: 'Los de la ficha y los de cualquiera de sus SteamID. Sin sesión. `{id}` acepta el id o el nick.',
  request: { params: IdParam, query: PlayerBanQuery },
  responses: { 200: { description: 'Baneos', ...json(BanList) }, ...errorResponses(400, 401, 404) },
});
const create = createRoute({
  method: 'post', path: '/api/v1/admin/bans', tags: ['Admin'], security: bearer, middleware: [requireUser, requireSupport] as const,
  summary: 'Banear',
  description:
    'Una ficha (vale para todos sus SteamID, también los que sume después) o un SteamID sin ficha, en todos los servidores. ' +
    'Soporte, moderadores y admins; `permanent` solo un admin. El soporte, solo con `minutes` (de 1 a 120), a quien no esté ' +
    'baneado y hasta 3 baneos de soporte por jugador en 7 días (`BUSINESS_RULE` con el motivo; ver `/admin/bans/support-quota`). Reemplaza al baneo activo que tuviera (queda levantado). Al conectarse, ' +
    'el servidor lo frena siempre; a quien ya está jugando (aunque sea un mix) lo echa en la sincronización, cada 3 minutos y al ' +
    'empezar cada mapa, o al momento con `!syncbans` en el servidor.',
  request: { body: { required: true, ...json(BanCreate) } },
  responses: { 201: { description: 'Baneado', ...json(Ban) }, ...errorResponses(400, 401, 403) },
});
const patch = createRoute({
  method: 'patch', path: '/api/v1/admin/bans/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireSupport] as const,
  summary: 'Cambiar un baneo',
  description:
    'El motivo o el vencimiento de un baneo activo. Uno permanente, o volverlo permanente, solo un admin. El soporte cambia solo ' +
    'los suyos, con `minutes`, y sin pasar de 120 minutos desde que lo puso.',
  request: { params: BanIdParam, body: { required: true, ...json(BanPatch) } },
  responses: { 200: { description: 'Cambiado', ...json(Ban) }, ...errorResponses(400, 401, 403, 404) },
});
const lift = createRoute({
  method: 'post', path: '/api/v1/admin/bans/{id}/lift', tags: ['Admin'], security: bearer, middleware: [requireUser, requireSupport] as const,
  summary: 'Levantar un baneo',
  description: 'Con motivo. No se borra: queda en la lista como levantado. Uno permanente, solo un admin. El soporte, solo los suyos.',
  request: { params: BanIdParam, body: { required: true, ...json(BanLift) } },
  responses: { 200: { description: 'Levantado', ...json(Ban) }, ...errorResponses(400, 401, 403, 404) },
});

const supportQuota = createRoute({
  method: 'get', path: '/api/v1/admin/bans/support-quota', tags: ['Admin'], security: bearer, middleware: [requireUser, requireSupport] as const,
  summary: 'Cupo de baneos de soporte',
  description: 'Cuántos baneos de soporte tiene esa ficha (o ese SteamID) en los últimos 7 días, de 3, y si ya está baneada (replanteo 117).',
  request: { query: SupportQuotaQuery },
  responses: { 200: { description: 'Cupo', ...json(SupportQuota) }, ...errorResponses(400, 401, 403) },
});
const supportActions = createRoute({
  method: 'get', path: '/api/v1/admin/support-actions', tags: ['Admin'], security: bearer, middleware: [requireUser, requireModerator] as const,
  summary: 'Actividad del soporte',
  description:
    'Cada acción de las cuentas de soporte: baneos, clips reprocesados, fotos y logos quitados, comentarios borrados, denuncias ' +
    'resueltas y sanciones de la cola levantadas (replanteo 117). Moderadores y admins. La base pagina, filtra y ordena.',
  request: { query: SupportActionQuery },
  responses: { 200: { description: 'Acciones', ...json(SupportActionList) }, ...errorResponses(400, 401, 403) },
});

const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

/** El soporte banea por minutos: ni vencimiento exacto ni permanente (replanteo 117). */
async function supportUsesMinutes(c: C, b: { expires_at?: string; permanent?: true }) {
  if ((b.expires_at !== undefined || b.permanent !== undefined) && (await userRole(c)) === 'support') {
    throw new AppError(403, 'FORBIDDEN', 'El soporte banea por minutos, de 1 a 120.');
  }
}

async function readBan(c: C, id: string) {
  const row = must(await c.var.sb.from('ban_list').select(BAN_FIELDS).eq('id', id).maybeSingle()) as BanRow | null;
  if (!row) throw notFound('ese baneo');
  return toBan(row, true);
}

export const bans = createRouter()
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    const mod = await isSupport(c);
    let q = c.var.sb.from('ban_list').select(BAN_FIELDS, { count: 'exact' });
    if (p.status) q = q.eq('status', p.status);
    if (p.source) q = q.eq('source', p.source);
    if (p.server) q = q.eq('server_id', p.server);
    const term = searchTerm(p.q);
    if (term) q = q.ilike(mod ? 'search_all' : 'search', `%${term}%`);
    const { rows, total } = await runList<BanRow, typeof q>(q, p, {});
    return c.json(envelope(rows.map((r) => toBan(r, mod)), total, p), 200);
  })
  .openapi(playerBans, async (c) => {
    const id = await resolvePlayer(c.var.sb, c.req.valid('param').id);
    const p = c.req.valid('query');
    const mod = await isSupport(c);
    let q = c.var.sb.from('ban_list').select(BAN_FIELDS, { count: 'exact' }).eq('player_id', id);
    if (p.status) q = q.eq('status', p.status);
    if (p.source) q = q.eq('source', p.source);
    const { rows, total } = await runList<BanRow, typeof q>(q, p, {});
    return c.json(envelope(rows.map((r) => toBan(r, mod)), total, p), 200);
  })
  .openapi(create, async (c) => {
    const b = c.req.valid('json');
    await supportUsesMinutes(c, b);
    // La función no tiene valores por defecto: lo que no se usa va en null.
    const id = mustHave(
      await c.var.sb.rpc('ban_create', {
        p_player: (b.player_id ?? null) as string, p_steam: (b.steam_id ?? null) as string, p_reason: b.reason,
        p_expires: (b.minutes !== undefined ? inMinutes(b.minutes) : (b.expires_at ?? null)) as string,
      }),
    );
    return c.json(await readBan(c, id), 201);
  })
  .openapi(patch, async (c) => {
    const { id } = c.req.valid('param');
    const b = c.req.valid('json');
    await supportUsesMinutes(c, b);
    await readBan(c, id);
    must(
      await c.var.sb.rpc('ban_update', {
        p_id: id, p_reason: (b.reason ?? null) as string,
        p_expires: (b.minutes !== undefined ? inMinutes(b.minutes) : (b.expires_at ?? null)) as string, p_permanent: b.permanent === true,
      }),
    );
    return c.json(await readBan(c, id), 200);
  })
  .openapi(lift, async (c) => {
    const { id } = c.req.valid('param');
    await readBan(c, id);
    must(await c.var.sb.rpc('ban_lift', { p_id: id, p_reason: c.req.valid('json').reason }));
    return c.json(await readBan(c, id), 200);
  })
  .openapi(supportQuota, async (c) => {
    const q = c.req.valid('query');
    const r = must(
      await c.var.sb.rpc('ban_support_quota', { p_player: (q.player_id ?? null) as string, p_steam: (q.steam_id ?? null) as string }),
    );
    return c.json(r as z.infer<typeof SupportQuota>, 200);
  })
  .openapi(supportActions, async (c) => {
    const p = c.req.valid('query');
    const r = must(
      await c.var.sb.rpc('support_actions_list', {
        p_actor: p.actor, p_action: p.action, p_from: p.from, p_to: p.to, p_order: p.order, p_limit: p.per, p_offset: (p.page - 1) * p.per,
      }),
    ) as { total: number; items: z.infer<typeof SupportActionList>['items'] };
    return c.json(envelope(r.items, r.total, p), 200);
  });
