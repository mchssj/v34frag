import { createRoute, type z } from '@hono/zod-openapi';
import { optionalUser } from '../lib/auth';
import { levelBounds, levelOf, must, mustHave, notFound, searchTerm } from '../lib/db';
import { AppError } from '../lib/errors';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import type { Db } from '../lib/supabase';
import { errorResponses, json } from '../schemas/common';
import { Compare, type ComparePlayer, CompareQuery, RankingPlayerList, RankingPlayerQuery, type TeamRef } from '../schemas/players';
import { applyPlayerFilters, FOUND, type FoundRow, toFound, wantsPlayerFilters } from '../services/playerFilters';
import { resolvePlayer, verifiedPlayers } from '../services/players';
import { requireVip, vipPlayers } from '../services/vip';
import { cosmeticsLight, type Light } from '../services/shop';

// Ranking de jugadores y comparador (plan docs/bitacora/2026-10-24-api-mixes-perfil-ranking). Vistas player_ranking y
// player_elo_history y función players_together del replanteo 27. Se monta antes que players: /players/compare no es un {id}.

const TREND = 30;

const rankingPlayers = createRoute({
  method: 'get', path: '/api/v1/ranking/players', tags: ['Ranking'], middleware: [optionalUser] as const,
  summary: 'Ranking de jugadores',
  description:
    'Jugadores con ELO (solo cuentan los mixes del servidor, con todos sus SteamID), por posición global. La posición no cambia al filtrar. ' +
    'Nivel: `10` (2001 o más), `7-9` (1351 a 2000) o `1-6` (menos de 1351). `elo_trend`: su ELO en sus últimos 30 mixes. ' +
    'Los filtros marcados VIP piden sesión (401) y VIP (403 `VIP_REQUIRED`).',
  request: { query: RankingPlayerQuery },
  responses: { 200: { description: 'Ranking', ...json(RankingPlayerList) }, ...errorResponses(400, 401, 403) },
});

const compare = createRoute({
  method: 'get', path: '/api/v1/players/compare', tags: ['Jugadores'], middleware: [optionalUser] as const,
  summary: 'Comparar de dos a cinco jugadores',
  description:
    'Stats de los dos (ELO, rating, K/D, HS %, ADR, % de victorias y partidas), su ELO en los últimos 30 mixes y los mixes que jugaron ' +
    'juntos (mismo bando) o como rivales. Aceptan el id o el nick. Con `c`, `d` o `e` (hasta 5 en total) pide sesión y VIP ' +
    '(403 `VIP_REQUIRED`); vienen en `others`.',
  request: { query: CompareQuery },
  responses: { 200: { description: 'Comparación', ...json(Compare) }, ...errorResponses(400, 401, 403, 404) },
});

/** ELO después de cada uno de los últimos `TREND` mixes de cada ficha, del más viejo al más nuevo. */
async function eloTrends(sb: Db, ids: string[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>(ids.map((id) => [id, []]));
  // De a 30 fichas: hasta 900 filas por consulta (PostgREST corta en 1000).
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const parts = await Promise.all(
    chunks.map(async (chunk) =>
      mustHave(await sb.from('player_elo_history').select('player_id, elo_after, n').in('player_id', chunk).lte('n', TREND).order('n', { ascending: false })),
    ),
  );
  for (const r of parts.flat()) if (r.player_id && r.elo_after !== null) out.get(r.player_id)?.push(r.elo_after);
  return out;
}

const num = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v));

type OverviewRow = {
  id: string | null; nick: string | null; photo_url: string | null; elo: number | null; elo_matches: number | null; maps: number | null;
  rating: number | null; kd: number | null; teams: unknown; user_id?: string | null;
};

async function comparePlayer(
  sb: Db, id: string, trend: number[], vip: Set<string>, verified: Map<string, 'gray' | 'gold'>, cosmetics: Map<string, Light>,
): Promise<z.infer<typeof ComparePlayer>> {
  const [o, s, p] = await Promise.all([
    sb.from('player_overview').select('id, nick, photo_url, elo, elo_matches, maps, rating, kd, teams').eq('id', id).maybeSingle().then(must),
    sb.from('player_stats').select('maps, hs, adr, wins, losses').eq('player_id', id).maybeSingle().then(must),
    sb.from('players').select('user_id').eq('id', id).maybeSingle().then(must),
  ]);
  if (!o) throw notFound('ese jugador');
  const row = o as OverviewRow;
  // El puesto respeta la privacidad del perfil (la RLS de profile_details).
  const d = p?.user_id ? must(await sb.from('profile_details').select('game_role').eq('user_id', p.user_id).maybeSingle()) : null;
  const played = (s?.wins ?? 0) + (s?.losses ?? 0);
  return {
    player: { id, alias: row.nick ?? '', photo_url: row.photo_url, vip: vip.has(id), verified: verified.get(id) ?? null, cosmetics: cosmetics.get(id) ?? null },
    teams: Array.isArray(row.teams) ? (row.teams as z.infer<typeof TeamRef>[]) : [],
    game_role: d?.game_role ?? null,
    level: levelOf(row.elo),
    elo: row.elo,
    rating: num(row.rating),
    kd: num(row.kd),
    hs: num(s?.hs),
    adr: num(s?.adr),
    win_rate: played ? Math.round(((s?.wins ?? 0) * 1000) / played) / 10 : null,
    matches: s?.maps ?? 0,
    elo_matches: row.elo_matches ?? 0,
    elo_history: trend,
  };
}

export const ranking = createRouter()
  .openapi(rankingPlayers, async (c) => {
    const p = c.req.valid('query');
    const sb = c.var.sb;
    // (replanteo 141) Con un filtro avanzado (VIP), la vista que trae esas columnas; no está en los tipos generados.
    const advanced = await wantsPlayerFilters(c, p);
    let q = sb
      .from((advanced ? 'player_ranking_search' : 'player_ranking') as 'player_ranking')
      .select(`id, nick, photo_url, elo, elo_matches, maps, rating, kd, teams, position, country, game_role${advanced ? `, ${FOUND}` : ''}` as '*', {
        count: 'exact',
      });
    if (advanced) q = applyPlayerFilters(q as never, p, 'maps');
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    if (p.team) q = q.contains('teams', JSON.stringify([{ id: p.team }]));
    const lv = levelBounds(p.level);
    if (lv.gte !== undefined) q = q.gte('elo', lv.gte);
    if (lv.lt !== undefined) q = q.lt('elo', lv.lt);
    type Row = OverviewRow & FoundRow & { position: number | null; country: string | null; game_role: string | null };
    const { rows, total } = await runList<Row, typeof q>(q, p, { matches: 'maps' });
    const ids = rows.map((r) => r.id!);
    const [trends, vip, verified, cosmetics] = await Promise.all([eloTrends(sb, ids), vipPlayers(sb, ids), verifiedPlayers(sb, ids), cosmeticsLight(sb, ids)]);
    return c.json(
      envelope(
        rows.map((r) => ({
          position: r.position ?? 0,
          player: {
            id: r.id!, alias: r.nick ?? '', photo_url: r.photo_url, vip: vip.has(r.id!), verified: verified.get(r.id!) ?? null,
            cosmetics: cosmetics.get(r.id!) ?? null,
          },
          level: levelOf(r.elo),
          elo: r.elo ?? 0,
          teams: Array.isArray(r.teams) ? (r.teams as z.infer<typeof TeamRef>[]) : [],
          rating: num(r.rating),
          kd: num(r.kd),
          matches: r.maps ?? 0,
          elo_matches: r.elo_matches ?? 0,
          country: r.country,
          game_role: r.game_role,
          elo_trend: trends.get(r.id!) ?? [],
          ...toFound(r),
        })),
        total,
        p,
      ),
      200,
    );
  })
  .openapi(compare, async (c) => {
    const p = c.req.valid('query');
    const sb = c.var.sb;
    const refs = [p.a, p.b, p.c, p.d, p.e].filter((x): x is string => !!x);
    // (bitácora 2026-11-24-comparador-y-favoritas-vip) Dos para todos, hasta cinco con VIP.
    if (refs.length > 2) await requireVip(c, 'Comparar más de dos jugadores es para los VIP.');
    const ids = await Promise.all(refs.map((r) => resolvePlayer(sb, r)));
    if (new Set(ids).size < ids.length) throw new AppError(400, 'VALIDATION_ERROR', 'Elige jugadores distintos.');
    const [trends, vip, verified, cosmetics] = await Promise.all([
      eloTrends(sb, ids), vipPlayers(sb, ids), verifiedPlayers(sb, ids), cosmeticsLight(sb, ids),
    ]);
    const [players, pairs] = await Promise.all([
      Promise.all(ids.map((id) => comparePlayer(sb, id, trends.get(id) ?? [], vip, verified, cosmetics))),
      Promise.all(
        ids.slice(1).map(async (id) => {
          const t = mustHave(await sb.rpc('players_together', { p_a: ids[0]!, p_b: id }))[0];
          return {
            same_team: { matches: t?.same_matches ?? 0, wins: t?.same_wins ?? 0 },
            against: { matches: t?.against_matches ?? 0, a_wins: t?.a_wins ?? 0 },
          };
        }),
      ),
    ]);
    return c.json(
      {
        a: players[0]!,
        b: players[1]!,
        together: pairs[0]!,
        others: players.slice(2).map((player, i) => ({ player, together: pairs[i + 2 - 1]! })),
      },
      200,
    );
  });
