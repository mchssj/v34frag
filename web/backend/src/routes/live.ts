import { createRoute, type z } from '@hono/zod-openapi';
import { optionalUser, requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave, notFound, searchTerm } from '../lib/db';
import { notModified } from '../lib/etag';
import { AppError, type PostgrestLikeError } from '../lib/errors';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import { IdParam } from '../schemas/admin';
import { STEAM64 } from '../schemas/claim';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  ApplyEloBody, ClosedMix, DeletedMix, DeleteMixBody, LiveMixDetail, LiveMixList, LiveMixQuery, type LivePlayerLine, UidParam,
} from '../schemas/live';
import { LIVE_LIST, liveRounds, serverTvs, toLiveSummary, type LiveRow } from '../services/live';

const done = { 204: { description: 'Hecho' } } as const;

// ---------- públicas ----------

const list = createRoute({
  method: 'get', path: '/api/v1/mixes/live', tags: ['Mixes en vivo'], middleware: [optionalUser] as const,
  summary: 'Mixes en vivo',
  description:
    'La última foto de cada mix en curso (el servidor manda una al final de cada ronda). Por defecto, el de la ronda más reciente primero. ' +
    'Para refrescar, consultar cada 20 segundos.',
  request: { query: LiveMixQuery },
  responses: { 200: { description: 'Mixes en vivo', ...json(LiveMixList) }, ...errorResponses(400, 401) },
});

const detail = createRoute({
  method: 'get', path: '/api/v1/mixes/live/{uid}', tags: ['Mixes en vivo'], middleware: [optionalUser] as const,
  summary: 'Detalle de un mix en vivo',
  description:
    'Marcador, rondas y stats parciales de cada jugador. 404 cuando el mix terminó: su resultado está en `GET /api/v1/matches?kind=mix`. ' +
    'Responde con `ETag`: con `If-None-Match` contesta `304` si no llegó una foto nueva.',
  request: { params: UidParam },
  responses: { 200: { description: 'Mix en vivo', ...json(LiveMixDetail) }, 304: { description: 'Sin cambios' }, ...errorResponses(400, 401, 404) },
});

// ---------- admin ----------

const applyElo = createRoute({
  method: 'post', path: '/api/v1/admin/mixes/{id}/apply-elo', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Aplicar el ELO de un mix interrumpido',
  description:
    'Mix cancelado por una caída (`review: pending`) con al menos el 35 % de las rondas y sin empate: pasa a terminado, gana el bando que iba ' +
    'adelante y se aplica el ELO. Si se jugaba con !match, se vincula a su partida de torneo o PCW. ' +
    'Pide `confirm: "estoy seguro"` (doble confirmación en el frontend).',
  request: { params: IdParam, body: { required: true, ...json(ApplyEloBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});

const discard = createRoute({
  method: 'post', path: '/api/v1/admin/mixes/{id}/discard', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Descartar un mix interrumpido', description: 'Queda cancelado y no cuenta para el ELO.',
  request: { params: IdParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});

const close = createRoute({
  method: 'post', path: '/api/v1/admin/mixes/live/{uid}/close', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cerrar como interrumpido un mix en vivo',
  description:
    'Para un mix sin fotos hace más de 10 minutos (`stale: true`): el servidor se cayó y no volvió. Queda cancelado por caída con la última ' +
    'foto y pendiente de revisión. Si después el servidor vuelve y lo manda, es la misma partida.',
  request: { params: UidParam },
  responses: { 200: { description: 'Partida creada', ...json(ClosedMix) }, ...errorResponses(400, 401, 403, 404) },
});

const remove = createRoute({
  method: 'delete', path: '/api/v1/admin/mixes/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Borrar un mix',
  description:
    'Mix terminado o cancelado, sin partida vinculada con !match. El admin elige qué pasa con el ELO que dio: `keep` (queda como está) o ' +
    '`revert` (se le resta a cada jugador). Nunca recalcula la historia. Se borran sus stats, chat, clips y la revisión de la caída; ' +
    'queda registrado para los admins. Pide `confirm: "estoy seguro"`.',
  request: { params: IdParam, body: { required: true, ...json(DeleteMixBody) } },
  responses: { 200: { description: 'Borrado', ...json(DeletedMix) }, ...errorResponses(400, 401, 403, 404) },
});

// Las funciones de los interrumpidos avisan con 22023 (regla) y P0002 (no existe): el mensaje es para el usuario.
function adminRpc<R extends { data: unknown; error: PostgrestLikeError | null }>(r: R): R['data'] {
  if (r.error?.code === '22023') throw new AppError(400, 'BUSINESS_RULE', r.error.message);
  if (r.error?.code === 'P0002') throw new AppError(404, 'NOT_FOUND', r.error.message);
  return must(r);
}

type LivePlayerRow = {
  side: number | null; steam_id: string | null; player_id: string | null; game_nick: string | null;
  rounds: number | null; kills: number | null; deaths: number | null; assists: number | null; headshots: number | null; damage: number | null;
  rating: number | null;
};

export const live = createRouter()
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('live_match_list').select(LIVE_LIST, { count: 'exact' });
    if (p.server) q = q.eq('server_id', p.server);
    if (p.player) q = q.contains('player_ids', [p.player]);
    if (p.map) q = q.ilike('map', `%${searchTerm(p.map) ?? ''}%`);
    if (p.stale !== undefined) q = q.eq('stale', p.stale);
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    const { rows, total } = await runList<LiveRow, typeof q>(q, p, {}, 'uid');
    const tvs = await serverTvs(c.var.sb, rows.map((r) => r.server_id));
    return c.json(envelope(rows.map((r) => toLiveSummary(r, tvs.get(r.server_id) ?? null)), total, p), 200);
  })
  .openapi(detail, async (c) => {
    const { uid } = c.req.valid('param');
    const { sb } = c.var;
    const [base, foto, people] = await Promise.all([
      sb.from('live_match_list').select(LIVE_LIST).eq('uid', uid).maybeSingle().then(must),
      sb.from('live_matches').select('rounds:payload->rounds').eq('uid', uid).maybeSingle().then(must),
      sb.from('live_match_players').select('side, steam_id, player_id, game_nick, rounds, kills, deaths, assists, headshots, damage, rating').eq('uid', uid).then(mustHave),
    ]);
    if (!base) throw notFound('ese mix en vivo (si terminó, está en las partidas)');
    const l = base as unknown as LiveRow;
    const rows = people as unknown as LivePlayerRow[];

    const linked = rows.map((r) => r.player_id).filter((x): x is string => !!x);
    const aliases = linked.length ? new Map(mustHave(await sb.from('players').select('id, nick').in('id', linked)).map((x) => [x.id, x.nick])) : new Map<string, string>();
    const players: z.infer<typeof LivePlayerLine>[] = rows
      .map((r) => ({
        player_id: r.player_id,
        alias: r.player_id ? (aliases.get(r.player_id) ?? null) : null,
        game_nick: r.game_nick ?? '?',
        // Sin ficha: el SteamID64 enlaza a su perfil sin reclamar (bots y NOSTEAM no tienen).
        steam_id: !r.player_id && r.steam_id && STEAM64.test(r.steam_id) ? r.steam_id : null,
        side: r.side,
        kills: r.kills, deaths: r.deaths, assists: r.assists, headshots: r.headshots, damage: r.damage, rounds: r.rounds,
        rating: r.rating === null ? null : Number(r.rating),
      }))
      .sort((a, b) => (a.side ?? 0) - (b.side ?? 0) || (b.rating ?? 0) - (a.rating ?? 0));

    const tv = (await serverTvs(sb, [l.server_id])).get(l.server_id) ?? null;
    const body = { ...toLiveSummary(l, tv), seq: l.seq, rounds: liveRounds((foto as { rounds?: unknown } | null)?.rounds), players };
    if (await notModified(c, body)) return c.body(null, 304);
    return c.json(body, 200);
  })
  .openapi(applyElo, async (c) => {
    adminRpc(await c.var.sb.rpc('elo_crash_apply', { p_match: c.req.valid('param').id }));
    return c.body(null, 204);
  })
  .openapi(discard, async (c) => {
    adminRpc(await c.var.sb.rpc('elo_crash_discard', { p_match: c.req.valid('param').id }));
    return c.body(null, 204);
  })
  .openapi(remove, async (c) => {
    const { elo } = c.req.valid('json');
    const r = adminRpc(await c.var.sb.rpc('admin_delete_mix', { p_match: c.req.valid('param').id, p_elo: elo })) as { elo_mode: string; players: number };
    return c.json({ elo_mode: r.elo_mode as 'keep' | 'revert' | 'none', players: r.players }, 200);
  })
  .openapi(close, async (c) => {
    const id = adminRpc(await c.var.sb.rpc('live_match_close', { p_uid: c.req.valid('param').uid }));
    return c.json({ match_id: id as string }, 200);
  });
