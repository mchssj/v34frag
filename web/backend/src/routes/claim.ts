import { createRoute } from '@hono/zod-openapi';
import { optionalUser, requireAdmin, requireUser } from '../lib/auth';
import { levelOf, must, mustHave, notFound, searchTerm } from '../lib/db';
import { AppError } from '../lib/errors';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import {
  AdminSteamRequestList,
  AdminSteamRequestQuery,
  ClaimCode,
  ClaimLogList,
  ClaimLogQuery,
  MySteamRequest,
  MySteamRequestList,
  MySteamRequestQuery,
  MySteamStatus,
  RejectBody,
  RequestIdParam,
  SteamConfig,
  SteamParam,
  STEAM_REQUEST_STATES,
  SteamProfile,
  UnclaimedList,
  UnclaimedQuery,
  UnlinkBody,
} from '../schemas/claim';
import { bearer, errorResponses, json } from '../schemas/common';
import { MapStatsQuery, PlayerMapStatsList, PlayerMatchList, PlayerMatchQuery } from '../schemas/players';
import { activeBan } from '../services/bans';

// Perfiles sin reclamar, !claim y varios SteamID por ficha (plan docs/bitacora/2026-10-16-claim-steamid).
// El !claim en sí lo hace el plugin contra claim_with_code; acá están el código, el estado y lo del admin.

const done = { 204: { description: 'Hecho' } } as const;
const UNCLAIMED = 'steam_id, last_nick, nicks, matches, first_played, last_played, elo, peak_elo, elo_matches';
const MATCH_FIELDS =
  'match_id, kind, played_at, map, side1_name, side2_name, team1_name, team2_name, score1, score2, side, won, parent_match_id, game_nick, kills, deaths, assists, headshots, damage, rounds, rating, elo_before, elo_after, elo_delta, demo_status';

type UnclaimedRow = {
  steam_id: string | null; last_nick: string | null; nicks: string[] | null; matches: number | null; first_played: string | null;
  last_played: string | null; elo: number | null; peak_elo: number | null; elo_matches: number | null;
};
const toUnclaimed = (r: UnclaimedRow) => ({
  steam_id: r.steam_id ?? '',
  last_nick: r.last_nick ?? null,
  nicks: r.nicks ?? [],
  matches: r.matches ?? 0,
  first_played: r.first_played ?? null,
  last_played: r.last_played ?? null,
  elo: r.elo ?? null,
  peak_elo: r.peak_elo ?? null,
  elo_matches: r.elo_matches ?? 0,
  level: levelOf(r.elo ?? null),
});

// ---------- públicas ----------

const unclaimed = createRoute({
  method: 'get', path: '/api/v1/players/unclaimed', tags: ['Jugadores'], middleware: [optionalUser] as const,
  summary: 'Buscar perfiles sin reclamar',
  description: 'SteamID que jugaron y todavía no son de ninguna ficha. **No es el ranking**: los perfiles sin reclamar no van al ranking ni a la lista de jugadores.',
  request: { query: UnclaimedQuery },
  responses: { 200: { description: 'Perfiles sin reclamar', ...json(UnclaimedList) }, ...errorResponses(400, 401) },
});
const steamProfile = createRoute({
  method: 'get', path: '/api/v1/players/steam/{steamid}', tags: ['Jugadores'], middleware: [optionalUser] as const,
  summary: 'Perfil sin reclamar',
  description: 'Lo que jugó un SteamID sin ficha. Si ya es de una ficha, `claimed: true` y `player_id` para redirigir.',
  request: { params: SteamParam },
  responses: { 200: { description: 'Perfil', ...json(SteamProfile) }, ...errorResponses(400, 401, 404) },
});
const steamMatches = createRoute({
  method: 'get', path: '/api/v1/players/steam/{steamid}/matches', tags: ['Jugadores'], middleware: [optionalUser] as const,
  summary: 'Partidas de un perfil sin reclamar', request: { params: SteamParam, query: PlayerMatchQuery },
  responses: { 200: { description: 'Partidas', ...json(PlayerMatchList) }, ...errorResponses(400, 401) },
});
const steamMapStats = createRoute({
  method: 'get', path: '/api/v1/players/steam/{steamid}/map-stats', tags: ['Jugadores'], middleware: [optionalUser] as const,
  summary: 'Stats por mapa de un perfil sin reclamar', request: { params: SteamParam, query: MapStatsQuery },
  responses: { 200: { description: 'Stats por mapa', ...json(PlayerMapStatsList) }, ...errorResponses(400, 401) },
});

// ---------- del usuario ----------

const newCode = createRoute({
  method: 'post', path: '/api/v1/me/claim-code', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Código para vincular el SteamID',
  description:
    'Código de un solo uso, válido 10 minutos (hasta 5 por hora). En el servidor: `!claim <código>`. El primer SteamID se vincula al ' +
    'instante; uno adicional queda pendiente hasta que lo apruebe un admin. El código anterior sin usar deja de valer.',
  responses: { 201: { description: 'Código', ...json(ClaimCode) }, ...errorResponses(400, 401) },
});
const myStatus = createRoute({
  method: 'get', path: '/api/v1/me/claim-code', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Estado del vínculo con el servidor',
  description: 'Mis SteamID, el tope y el último código (para consultar cada 5 segundos mientras se espera el `!claim`).',
  responses: { 200: { description: 'Estado', ...json(MySteamStatus) }, ...errorResponses(401) },
});
const myRequests = createRoute({
  method: 'get', path: '/api/v1/me/steam-requests', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Mis pedidos de SteamID', description: 'De SteamID adicional (`kind: add`, con `!claim`) y de desvincular (`kind: remove`).',
  request: { query: MySteamRequestQuery },
  responses: { 200: { description: 'Solicitudes', ...json(MySteamRequestList) }, ...errorResponses(400, 401) },
});
const unlinkRequest = createRoute({
  method: 'post', path: '/api/v1/me/steam/{steamid}/unlink', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Pedir desvincular un SteamID',
  description:
    'Queda pendiente hasta que un admin lo apruebe (`POST /api/v1/admin/steam-requests/{id}/approve`); vence a los 30 días. Al aprobarlo, sus ' +
    'partidas vuelven a quedar sin ficha y, si era el principal, el adicional más viejo pasa a serlo. No se puede pedir para el único SteamID de la ficha.',
  request: { params: SteamParam, body: { required: false, ...json(UnlinkBody) } },
  responses: { 201: { description: 'Pedido', ...json(MySteamRequest) }, ...errorResponses(400, 401) },
});
const cancelUnlink = createRoute({
  method: 'delete', path: '/api/v1/me/steam/{steamid}/unlink', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Cancelar el pedido de desvincular un SteamID',
  description: 'Mientras siga pendiente. El pedido queda con `status: cancelled` y el SteamID sigue en la ficha. Falla si no hay un pedido pendiente para ese SteamID.',
  request: { params: SteamParam },
  responses: { ...done, ...errorResponses(400, 401) },
});
const myPrimary = createRoute({
  method: 'post', path: '/api/v1/me/steam/{steamid}/primary', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Hacer principal uno de mis SteamID',
  description:
    'Sin aprobación, **una vez cada 24 horas**. El ELO de la ficha no cambia: pasa a la clave del principal nuevo. No se puede con un SteamID que tiene pedido de desvincular.',
  request: { params: SteamParam },
  responses: { ...done, ...errorResponses(400, 401) },
});

// ---------- admin ----------

const adminRequests = createRoute({
  method: 'get', path: '/api/v1/admin/steam-requests', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Pedidos de SteamID',
  description: 'De SteamID adicional (`kind: add`) y de desvincular (`kind: remove`). Por defecto, los pendientes primero. Los de más de 30 días vencen solos.',
  request: { query: AdminSteamRequestQuery },
  responses: { 200: { description: 'Solicitudes', ...json(AdminSteamRequestList) }, ...errorResponses(400, 401, 403) },
});
const approve = createRoute({
  method: 'post', path: '/api/v1/admin/steam-requests/{id}/approve', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Aprobar un pedido de SteamID',
  description:
    '`add`: lo suma a la ficha, le pasa su historial y **recalcula el ELO de todos** (un solo ELO por ficha); falla si comparte partidas con otro SteamID de la ficha. ' +
    '`remove`: lo saca de la ficha como `DELETE /api/v1/admin/steam/{steamid}`; falla si es el único SteamID de la ficha.',
  request: { params: RequestIdParam },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});
const reject = createRoute({
  method: 'post', path: '/api/v1/admin/steam-requests/{id}/reject', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Rechazar un pedido de SteamID', request: { params: RequestIdParam, body: { required: true, ...json(RejectBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});
const claimLog = createRoute({
  method: 'get', path: '/api/v1/admin/claims', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Registro de reclamos', description: 'Cada `!claim`, aceptado o no, y los reclamos del sistema viejo.',
  request: { query: ClaimLogQuery },
  responses: { 200: { description: 'Registro', ...json(ClaimLogList) }, ...errorResponses(400, 401, 403) },
});
const getConfig = createRoute({
  method: 'get', path: '/api/v1/admin/steam/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Tope de SteamID por ficha', responses: { 200: { description: 'Configuración', ...json(SteamConfig) }, ...errorResponses(401, 403) },
});
const putConfig = createRoute({
  method: 'put', path: '/api/v1/admin/steam/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar el tope de SteamID por ficha',
  description: 'De 1 a 4. Bajarlo no les quita SteamID a quienes ya tienen más: solo frena nuevas solicitudes.',
  request: { body: { required: true, ...json(SteamConfig) } },
  responses: { 200: { description: 'Guardado', ...json(SteamConfig) }, ...errorResponses(400, 401, 403) },
});
const removeSteam = createRoute({
  method: 'delete', path: '/api/v1/admin/steam/{steamid}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Quitar un SteamID de su ficha',
  description:
    'Sus partidas vuelven a quedar sin ficha. Si era el principal, el adicional más viejo pasa a serlo. Si la ficha tenía varios, recalcula el ELO. ' +
    'Si el jugador había pedido desvincularlo, el pedido queda aprobado.',
  request: { params: SteamParam },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});
const setPrimary = createRoute({
  method: 'post', path: '/api/v1/admin/steam/{steamid}/primary', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Hacer principal un SteamID adicional', description: 'Sin límite de cambios. El ELO de la ficha no cambia: pasa a la clave del principal nuevo.',
  request: { params: SteamParam },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

type RequestRow = {
  id: number; kind: string; steam_id: string; nick: string | null; status: string; note: string | null; reason: string | null; created_at: string; resolved_at: string | null;
};
const REQUEST = 'id, kind, steam_id, nick, status, note, reason, created_at, resolved_at';
const toRequest = (r: RequestRow) => ({
  ...r,
  kind: r.kind as 'add' | 'remove',
  status: r.status as (typeof STEAM_REQUEST_STATES)[number],
});

type MatchRow = Record<string, unknown> & { match_id: string; kind: string; side1_name: string | null; side2_name: string | null; team1_name: string | null; team2_name: string | null };
const ref = (id: string | null, name: string | null) => (id ? { id, name: name ?? '' } : null);

export const claim = createRouter()
  .openapi(unclaimed, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('steam_profile_list').select(UNCLAIMED, { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    const { rows, total } = await runList<UnclaimedRow, typeof q>(q, p, {}, 'steam_id');
    return c.json(envelope(rows.map(toUnclaimed), total, p), 200);
  })
  .openapi(steamProfile, async (c) => {
    const { steamid } = c.req.valid('param');
    const sb = c.var.sb;
    const owner = must(await sb.from('player_steam_all').select('player_id').eq('steam_id', steamid).maybeSingle());
    if (owner?.player_id) return c.json({ steam_id: steamid, claimed: true, player_id: owner.player_id, profile: null, ban: null }, 200);
    const [row, stats, ban] = await Promise.all([
      sb.from('steam_profile_list').select(UNCLAIMED).eq('steam_id', steamid).maybeSingle().then(must),
      sb.from('steam_profile_stats').select('maps, rounds, kills, deaths, assists, damage, rating, kd, hs, adr, wins, losses').eq('steam_id', steamid).maybeSingle().then(must),
      activeBan(sb, { steam: steamid }),
    ]);
    if (!row) throw notFound('un perfil con ese SteamID');
    return c.json({ steam_id: steamid, claimed: false, player_id: null, profile: { ...toUnclaimed(row), stats: stats ?? null }, ban }, 200);
  })
  .openapi(steamMatches, async (c) => {
    const { steamid } = c.req.valid('param');
    const p = c.req.valid('query');
    let q = c.var.sb.from('steam_profile_matches').select(MATCH_FIELDS, { count: 'exact' }).eq('steam_id', steamid);
    if (p.kind) q = q.eq('kind', p.kind);
    if (p.result === 'won') q = q.eq('won', true);
    if (p.result === 'lost') q = q.eq('won', false);
    if (p.result === 'draw') q = q.is('won', null);
    if (p.map) q = q.ilike('map', `%${searchTerm(p.map) ?? ''}%`);
    if (p.from) q = q.gte('played_at', p.from);
    if (p.to) q = q.lte('played_at', p.to);
    const { rows, total } = await runList<MatchRow, typeof q>(q, p, {}, 'match_id');
    const items = rows.map(({ team1_name, team2_name, ...m }) => ({
      ...m,
      kind: m.kind as 'mix' | 'pcw' | 'official',
      side1_name: m.side1_name ?? team1_name,
      side2_name: m.side2_name ?? team2_name,
    }));
    return c.json(envelope(items, total, p) as never, 200);
  })
  .openapi(steamMapStats, async (c) => {
    const { steamid } = c.req.valid('param');
    const p = c.req.valid('query');
    let q = c.var.sb.from('steam_profile_map_stats').select('map_name, maps, rating, kd, adr, wins, losses', { count: 'exact' }).eq('steam_id', steamid);
    if (p.map) q = q.ilike('map_name', `%${searchTerm(p.map) ?? ''}%`);
    type Row = { map_name: string | null; maps: number | null; rating: number | null; kd: number | null; adr: number | null; wins: number | null; losses: number | null };
    const { rows, total } = await runList<Row, typeof q>(q, p, {}, 'map_name');
    return c.json(envelope(rows.map(({ map_name, ...m }) => ({ map: map_name ?? '?', ...m })), total, p), 200);
  })
  .openapi(newCode, async (c) => {
    const row = mustHave(await c.var.sb.rpc('create_claim_code'))[0];
    if (!row) throw new AppError(500, 'INTERNAL', 'Supabase no devolvió el código.');
    return c.json({ code: row.code, expires_at: row.expires_at, command: `!claim ${row.code}` }, 201);
  })
  .openapi(myStatus, async (c) => {
    const { sb, user } = c.var;
    const [player, last, cfg] = await Promise.all([
      sb.from('players').select('id').eq('user_id', user.id).maybeSingle().then(must),
      sb.from('claim_codes').select('code, expires_at, used_at, used_steam_id, result').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle().then(must),
      sb.from('claim_config').select('max_steam_ids').eq('id', 1).maybeSingle().then(must),
    ]);
    const [steams, pending] = await Promise.all([
      player ? sb.from('player_steam_all').select('steam_id, is_primary, added_at').eq('player_id', player.id).then(mustHave) : Promise.resolve([]),
      sb.from('steam_requests').select('steam_id, kind').eq('user_id', user.id).eq('status', 'pending').then(mustHave),
    ]);
    const unlinking = new Set(pending.filter((r) => r.kind === 'remove').map((r) => r.steam_id));
    const now = Date.now();
    return c.json(
      {
        steam_ids: steams
          .map((s) => ({
            steam_id: s.steam_id ?? '', is_primary: s.is_primary ?? false, added_at: s.added_at ?? null, unlink_pending: unlinking.has(s.steam_id ?? ''),
          }))
          .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.steam_id.localeCompare(b.steam_id)),
        max_steam_ids: cfg?.max_steam_ids ?? 3,
        last_code: last
          ? {
              code: last.code,
              status: last.used_at ? ('used' as const) : new Date(last.expires_at).getTime() > now ? ('pending' as const) : ('expired' as const),
              expires_at: last.expires_at,
              used_at: last.used_at,
              used_steam_id: last.used_steam_id,
              result: last.result,
            }
          : null,
        pending_requests: pending.length,
      },
      200,
    );
  })
  .openapi(myRequests, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('steam_requests').select(REQUEST, { count: 'exact' }).eq('user_id', c.var.user.id);
    if (p.status) q = q.eq('status', p.status);
    if (p.kind) q = q.eq('kind', p.kind);
    const { rows, total } = await runList<RequestRow, typeof q>(q, p, {});
    return c.json(envelope(rows.map(toRequest), total, p), 200);
  })
  .openapi(unlinkRequest, async (c) => {
    const sb = c.var.sb;
    const id = mustHave(await sb.rpc('request_steam_unlink', { p_steam: c.req.valid('param').steamid, p_note: c.req.valid('json')?.reason ?? '' }));
    const row = must(await sb.from('steam_requests').select(REQUEST).eq('id', id).maybeSingle());
    if (!row) throw new AppError(500, 'INTERNAL', 'Supabase no devolvió el pedido.');
    return c.json(toRequest(row), 201);
  })
  .openapi(cancelUnlink, async (c) => {
    must(await c.var.sb.rpc('cancel_steam_unlink', { p_steam: c.req.valid('param').steamid }));
    return c.body(null, 204);
  })
  .openapi(myPrimary, async (c) => {
    must(await c.var.sb.rpc('set_my_primary_steam', { p_steam: c.req.valid('param').steamid }));
    return c.body(null, 204);
  })
  .openapi(adminRequests, async (c) => {
    const p = c.req.valid('query');
    must(await c.var.sb.rpc('steam_requests_expire'));
    let q = c.var.sb
      .from('admin_steam_requests')
      .select('id, kind, status, created_at, resolved_at, note, reason, steam_id, nick, player_id, player_nick, user_id, alias, server_id, server_name, matches, player_steam_count, shares_match', { count: 'exact' });
    if (p.status) q = q.eq('status', p.status);
    if (p.kind) q = q.eq('kind', p.kind);
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    type Row = {
      id: number; kind: string; status: string; created_at: string; resolved_at: string | null; note: string | null; reason: string | null; steam_id: string; nick: string | null;
      player_id: string; player_nick: string; user_id: string | null; alias: string | null; server_id: string | null; server_name: string | null;
      matches: number; player_steam_count: number; shares_match: boolean;
    };
    const { rows, total } = await runList<Row, typeof q>(q, p, { status: ['status_order', 'created_at'] });
    return c.json(
      envelope(
        rows.map((r) => ({
          id: r.id, kind: r.kind as 'add' | 'remove', steam_id: r.steam_id, nick: r.nick, status: r.status as (typeof STEAM_REQUEST_STATES)[number],
          note: r.note, reason: r.reason,
          created_at: r.created_at, resolved_at: r.resolved_at,
          player: { id: r.player_id, nick: r.player_nick },
          user: r.user_id ? { id: r.user_id, alias: r.alias } : null,
          server: ref(r.server_id, r.server_name),
          matches: r.matches ?? 0, player_steam_count: r.player_steam_count ?? 0, shares_match: r.shares_match ?? false,
        })),
        total,
        p,
      ),
      200,
    );
  })
  .openapi(approve, async (c) => {
    must(await c.var.sb.rpc('approve_steam_request', { p_id: c.req.valid('param').id }));
    return c.body(null, 204);
  })
  .openapi(reject, async (c) => {
    must(await c.var.sb.rpc('reject_steam_request', { p_id: c.req.valid('param').id, p_reason: c.req.valid('json').reason ?? '' }));
    return c.body(null, 204);
  })
  .openapi(claimLog, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb
      .from('admin_claim_log')
      .select('id, created_at, ok, result, steam_id, nick, user_id, alias, player_id, player_nick, server_id, server_name', { count: 'exact' });
    if (p.ok !== undefined) q = q.eq('ok', p.ok);
    if (p.steam_id) q = q.eq('steam_id', p.steam_id);
    if (p.from) q = q.gte('created_at', p.from);
    if (p.to) q = q.lte('created_at', p.to);
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    type Row = {
      id: number; created_at: string; ok: boolean; result: string; steam_id: string | null; nick: string | null; user_id: string | null; alias: string | null;
      player_id: string | null; player_nick: string | null; server_id: string | null; server_name: string | null;
    };
    const { rows, total } = await runList<Row, typeof q>(q, p, {});
    return c.json(
      envelope(
        rows.map((r) => ({
          id: r.id, created_at: r.created_at, ok: r.ok, result: r.result, steam_id: r.steam_id, nick: r.nick,
          user: r.user_id ? { id: r.user_id, alias: r.alias } : null,
          player: r.player_id ? { id: r.player_id, nick: r.player_nick ?? '' } : null,
          server: ref(r.server_id, r.server_name),
        })),
        total,
        p,
      ),
      200,
    );
  })
  .openapi(getConfig, async (c) => {
    const cfg = must(await c.var.sb.from('claim_config').select('max_steam_ids').eq('id', 1).maybeSingle());
    return c.json({ max_steam_ids: cfg?.max_steam_ids ?? 3 }, 200);
  })
  .openapi(putConfig, async (c) => {
    const n = must(await c.var.sb.rpc('set_claim_config', { p_max_steam_ids: c.req.valid('json').max_steam_ids }));
    return c.json({ max_steam_ids: n ?? c.req.valid('json').max_steam_ids }, 200);
  })
  .openapi(removeSteam, async (c) => {
    must(await c.var.sb.rpc('admin_remove_steam', { p_steam: c.req.valid('param').steamid }));
    return c.body(null, 204);
  })
  .openapi(setPrimary, async (c) => {
    must(await c.var.sb.rpc('admin_set_primary_steam', { p_steam: c.req.valid('param').steamid }));
    return c.body(null, 204);
  });
