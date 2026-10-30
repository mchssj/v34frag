import { createRoute, type z } from '@hono/zod-openapi';
import { currentUser, optionalUser } from '../lib/auth';
import { levelOf, must, mustHave, searchTerm } from '../lib/db';
import { AppError } from '../lib/errors';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import { errorResponses, json } from '../schemas/common';
import { type MixItem, MixList, MixListQuery, MixStats } from '../schemas/live';
import type { ReviewStatus } from '../schemas/common';
import { toTv } from '../services/live';

// Listado único de mixes (en vivo, terminados y cancelados) y los números de la cabecera
// (plan docs/bitacora/2026-10-24-api-mixes-perfil-ranking). Vistas mix_list y mix_stats del replanteo 27.

const MIX_LIST =
  'match_id, live_uid, status, map, server_id, server_name, score1, score2, winner_side, side1_name, side2_name, rounds_played, ' +
  'current_round, max_rounds, started_at, ended_at, cancel_reason, demo_status, stale, mvp_player_id, mvp_alias, mvp_game_nick, ' +
  'mvp_elo, mvp_rating, tv_host, tv_port';

type Review = z.infer<typeof ReviewStatus>;

type MixRow = {
  match_id: string | null; live_uid: string | null; status: string; map: string | null; server_id: string | null; server_name: string | null;
  score1: number | null; score2: number | null; winner_side: number | null; side1_name: string | null; side2_name: string | null;
  rounds_played: number | null; current_round: number | null; max_rounds: number | null; started_at: string | null; ended_at: string | null;
  cancel_reason: string | null; demo_status: string | null; stale: boolean | null; mvp_player_id: string | null; mvp_alias: string | null;
  mvp_game_nick: string | null; mvp_elo: number | null; mvp_rating: number | null; tv_host: string | null; tv_port: number | null;
};

/** `review`: estado de la revisión del ELO si es un mix interrumpido (sale de `match_list`). */
export function toMixItem(r: MixRow, review: Review | null = null): z.infer<typeof MixItem> {
  const hasMvp = r.mvp_player_id !== null || r.mvp_game_nick !== null;
  return {
    match_id: r.match_id,
    live_uid: r.live_uid,
    status: r.status as z.infer<typeof MixItem>['status'],
    map: r.map,
    server: r.server_id ? { id: r.server_id, name: r.server_name } : null,
    started_at: r.started_at,
    ended_at: r.ended_at,
    side1: { name: r.side1_name, score: r.score1 },
    side2: { name: r.side2_name, score: r.score2 },
    winner_side: r.winner_side,
    rounds_played: r.rounds_played ?? 0,
    current_round: r.current_round,
    max_rounds: r.max_rounds,
    stale: !!r.stale,
    mvp: hasMvp
      ? {
          player_id: r.mvp_player_id,
          alias: r.mvp_alias,
          game_nick: r.mvp_game_nick,
          elo: r.mvp_elo,
          level: levelOf(r.mvp_elo),
          rating: r.mvp_rating === null ? null : Number(r.mvp_rating),
        }
      : null,
    demo_status: r.demo_status ?? 'none',
    cancel_reason: r.cancel_reason,
    review: r.match_id ? review : null,
    tv: r.status === 'live' ? toTv(r.tv_host, r.tv_port) : null,
  };
}

const list = createRoute({
  method: 'get', path: '/api/v1/mixes', tags: ['Mixes'], middleware: [optionalUser] as const,
  summary: 'Mixes: en vivo, terminados y cancelados',
  description:
    'Todos los mixes en un solo listado. Por defecto, los en vivo primero y después por fecha de inicio, del más nuevo al más viejo. ' +
    'Una fila en vivo trae `live_uid` (su detalle en `GET /api/v1/mixes/live/{uid}`), la ronda actual y `tv`; una terminada o cancelada, ' +
    '`match_id` (`GET /api/v1/matches/{id}`). `mine=true` pide sesión.',
  request: { query: MixListQuery },
  responses: { 200: { description: 'Mixes', ...json(MixList) }, ...errorResponses(400, 401) },
});

const stats = createRoute({
  method: 'get', path: '/api/v1/mixes/stats', tags: ['Mixes'], middleware: [optionalUser] as const,
  summary: 'Números de los mixes',
  description: 'En vivo ahora, jugadores distintos, mapa más jugado y promedio de rondas de los últimos 30 días. Sin sesión.',
  responses: { 200: { description: 'Números', ...json(MixStats) }, ...errorResponses(401) },
});

export const mixes = createRouter()
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    const sb = c.var.sb;
    let q = sb.from('mix_list').select(MIX_LIST, { count: 'exact' });
    if (p.mine) {
      const user = currentUser(c);
      if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Para ver tus mixes tienes que iniciar sesión.');
      const me = must(await sb.from('players').select('id').eq('user_id', user.id).maybeSingle());
      if (!me) return c.json(envelope([], 0, p), 200);
      q = q.contains('player_ids', [me.id]);
    }
    if (p.status) q = q.eq('status', p.status);
    if (p.hide_cancelled) q = q.neq('status', 'cancelled');
    if (p.server) q = q.eq('server_id', p.server);
    if (p.map) q = q.ilike('map', `%${searchTerm(p.map) ?? ''}%`);
    if (p.from) q = q.gte('at', p.from);
    if (p.to) q = q.lte('at', p.to);
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    // started_at: los en vivo primero (live_rank) y después por fecha; el desempate, por partida y por uid.
    const { rows, total } = await runList<MixRow, typeof q>(q, p, { started_at: ['live_rank', 'at'], rounds: 'rounds_played' }, 'match_id');
    const ids = rows.map((r) => r.match_id).filter((x): x is string => !!x);
    const reviews = ids.length
      ? new Map(mustHave(await sb.from('match_list').select('id, review').in('id', ids)).map((r) => [r.id as string, r.review as Review | null]))
      : new Map<string, Review | null>();
    return c.json(envelope(rows.map((r) => toMixItem(r, r.match_id ? (reviews.get(r.match_id) ?? null) : null)), total, p), 200);
  })
  .openapi(stats, async (c) => {
    const s = must(await c.var.sb.from('mix_stats').select('live_now, players_recent, top_map, avg_rounds, window_days').single());
    return c.json(
      {
        live_now: s?.live_now ?? 0,
        players_recent: s?.players_recent ?? 0,
        top_map: s?.top_map ?? null,
        avg_rounds: s?.avg_rounds === null || s?.avg_rounds === undefined ? null : Number(s.avg_rounds),
        window_days: s?.window_days ?? 30,
      },
      200,
    );
  });
