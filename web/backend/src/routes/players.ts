import { createRoute, type z } from '@hono/zod-openapi';
import { currentUser, isAdmin, optionalUser, requireUser } from '../lib/auth';
import { levelOf, must, mustHave, notFound, searchTerm } from '../lib/db';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import type { Db } from '../lib/supabase';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  EloHistoryList,
  EloHistoryQuery,
  IdParam,
  MapStatsQuery,
  MedalSummaryList,
  MedalSummaryQuery,
  MedalList,
  MedalQuery,
  PlayerDetail,
  PlayerList,
  PlayerListQuery,
  PlayerMapStatsList,
  PlayerMatchList,
  PlayerMatchQuery,
  StintQuery,
  TeamStintList,
  TitleList,
  TitleQuery,
  type PlayerSummary,
} from '../schemas/players';
import { activeBan } from '../services/bans';
import { vipPlayers } from '../services/vip';
import { resolvePlayer } from '../services/players';
import { stageLabel } from '../services/stages';
import { clutchesOf } from '../services/matches';

const OVERVIEW = 'id, nick, has_account, has_steam, photo_url, privacy, elo, peak_elo, elo_matches, maps, rating, kd, wins, losses, teams';
const MATCH_FIELDS =
  'match_id, kind, played_at, map, side1_name, side2_name, team1_name, team2_name, score1, score2, side, won, parent_match_id, game_nick, kills, deaths, assists, headshots, damage, rounds, rating, elo_before, elo_after, elo_delta, demo_status, event_id, event_name, stage, phase, grp, round, last_round';
const DETAILS = 'avatar_url, real_name, country, game_role, steam, faceit, discord, joined_at, last_seen';

type OverviewRow = {
  id: string | null; nick: string | null; has_account: boolean | null; has_steam: boolean | null; photo_url: string | null;
  elo: number | null; elo_matches: number | null; maps: number | null; rating: number | null; kd: number | null;
  wins: number | null; losses: number | null; teams: unknown;
};

export const toSummary = (r: OverviewRow, vip: Set<string>): z.infer<typeof PlayerSummary> => ({
  id: r.id!,
  alias: r.nick ?? '',
  has_account: !!r.has_account,
  has_steam: !!r.has_steam,
  photo_url: r.photo_url,
  elo: r.elo,
  level: levelOf(r.elo),
  elo_matches: r.elo_matches ?? 0,
  maps: r.maps,
  rating: r.rating,
  kd: r.kd,
  wins: r.wins,
  losses: r.losses,
  teams: Array.isArray(r.teams) ? (r.teams as z.infer<typeof PlayerSummary>['teams']) : [],
  vip: vip.has(r.id!),
});

// ---------- rutas ----------

const list = createRoute({
  method: 'get',
  path: '/api/v1/players',
  tags: ['Jugadores'],
  summary: 'Jugadores',
  description:
    'Listado paginado; por defecto ordenado por ELO (el ranking de jugadores). Sin sesión. ' +
    'El nivel (1 a 10) sale de los tramos de ELO 0, 501, 751, 901, 1051, 1201, 1351, 1531, 1751 y 2001.',
  middleware: [optionalUser] as const,
  request: { query: PlayerListQuery },
  responses: { 200: { description: 'Jugadores', ...json(PlayerList) }, ...errorResponses(400, 401) },
});

const detail = createRoute({
  method: 'get',
  path: '/api/v1/players/{id}',
  tags: ['Jugadores'],
  summary: 'Ficha de un jugador',
  description:
    'Datos, ELO, stats y equipos actuales. Los datos personales (`details`) solo vienen si el perfil es público, si es el propio ' +
    'o si quien consulta es admin. Los SteamID (`steam_id`, `steam_ids`) solo los ven el dueño y los admins. `{id}` acepta el id o el nick. ' +
    'Stats por mapa, medallas, historial y partidas van en sus listados.',
  middleware: [optionalUser] as const,
  request: { params: IdParam },
  responses: { 200: { description: 'Ficha', ...json(PlayerDetail) }, ...errorResponses(400, 401, 404) },
});

const matches = createRoute({
  method: 'get',
  path: '/api/v1/players/{id}/matches',
  tags: ['Jugadores'],
  summary: 'Partidas de un jugador',
  description: 'Partidas terminadas que jugó en el servidor, con sus stats y su cambio de ELO.',
  middleware: [optionalUser] as const,
  request: { params: IdParam, query: PlayerMatchQuery },
  responses: { 200: { description: 'Partidas', ...json(PlayerMatchList) }, ...errorResponses(400, 401) },
});

const myMatches = createRoute({
  method: 'get',
  path: '/api/v1/me/matches',
  tags: ['Mi perfil'],
  summary: 'Mis partidas',
  description:
    'Como `GET /api/v1/players/{id}/matches`, con la ficha de la cuenta. Si la cuenta todavía no tiene ficha (no usó `!claim`), ' +
    'la lista viene vacía.',
  security: bearer,
  middleware: [requireUser] as const,
  request: { query: PlayerMatchQuery },
  responses: { 200: { description: 'Partidas', ...json(PlayerMatchList) }, ...errorResponses(400, 401) },
});

const mapStats = createRoute({
  method: 'get',
  path: '/api/v1/players/{id}/map-stats',
  tags: ['Jugadores'],
  summary: 'Stats por mapa de un jugador',
  middleware: [optionalUser] as const,
  request: { params: IdParam, query: MapStatsQuery },
  responses: { 200: { description: 'Stats por mapa', ...json(PlayerMapStatsList) }, ...errorResponses(400, 401) },
});

const medals = createRoute({
  method: 'get',
  path: '/api/v1/players/{id}/medals',
  tags: ['Jugadores'],
  summary: 'Medallas de un jugador',
  middleware: [optionalUser] as const,
  request: { params: IdParam, query: MedalQuery },
  responses: { 200: { description: 'Medallas', ...json(MedalList) }, ...errorResponses(400, 401) },
});

const teams = createRoute({
  method: 'get',
  path: '/api/v1/players/{id}/teams',
  tags: ['Jugadores'],
  summary: 'Historial de equipos de un jugador',
  description: 'Equipos oficiales actuales y anteriores, con rol y fechas de alta y baja.',
  middleware: [optionalUser] as const,
  request: { params: IdParam, query: StintQuery },
  responses: { 200: { description: 'Equipos', ...json(TeamStintList) }, ...errorResponses(400, 401) },
});

const eloHistory = createRoute({
  method: 'get',
  path: '/api/v1/players/{id}/elo-history',
  tags: ['Jugadores'],
  summary: 'Historial de ELO de un jugador',
  description: 'Su ELO después de cada mix que lo movió, para el gráfico del perfil. Por defecto los 30 más recientes, del más nuevo al más viejo.',
  middleware: [optionalUser] as const,
  request: { params: IdParam, query: EloHistoryQuery },
  responses: { 200: { description: 'Historial', ...json(EloHistoryList) }, ...errorResponses(400, 401, 404) },
});

const titles = createRoute({
  method: 'get',
  path: '/api/v1/players/{id}/titles',
  tags: ['Jugadores'],
  summary: 'Palmarés de un jugador',
  description: 'Torneos que ganó (campeón) y finales que perdió (subcampeón), con el equipo con el que estaba inscrito y la fecha de la final.',
  middleware: [optionalUser] as const,
  request: { params: IdParam, query: TitleQuery },
  responses: { 200: { description: 'Palmarés', ...json(TitleList) }, ...errorResponses(400, 401, 404) },
});

const medalSummary = createRoute({
  method: 'get',
  path: '/api/v1/players/{id}/medals/summary',
  tags: ['Jugadores'],
  summary: 'Medallas de un jugador, agrupadas',
  description: 'Una fila por medalla distinta (título e icono) con la cantidad, para "Logros". El detalle de cada una está en `/players/{id}/medals`.',
  middleware: [optionalUser] as const,
  request: { params: IdParam, query: MedalSummaryQuery },
  responses: { 200: { description: 'Medallas agrupadas', ...json(MedalSummaryList) }, ...errorResponses(400, 401, 404) },
});

/** Partidas terminadas de una ficha, con sus stats (lo comparten la ficha y Mi perfil). */
async function playerMatches(sb: Db, playerId: string, p: z.infer<typeof PlayerMatchQuery>) {
  let q = sb.from('player_matches').select(MATCH_FIELDS, { count: 'exact' }).eq('player_id', playerId);
  if (p.kind) q = q.eq('kind', p.kind);
  if (p.result === 'won') q = q.eq('won', true);
  if (p.result === 'lost') q = q.eq('won', false);
  if (p.result === 'draw') q = q.is('won', null);
  if (p.map) q = q.ilike('map', `%${searchTerm(p.map) ?? ''}%`);
  if (p.from) q = q.gte('played_at', p.from);
  if (p.to) q = q.lte('played_at', p.to);
  type Row = Record<string, unknown> & {
    match_id: string; kind: string; side1_name: string | null; side2_name: string | null; team1_name: string | null; team2_name: string | null;
    event_id: string | null; event_name: string | null; stage: string | null; phase: number | null; grp: number | null; round: number | null;
    last_round: number | null;
  };
  const { rows, total } = await runList<Row, typeof q>(q, p, {}, 'match_id');
  // En PCW y torneos el bando es el equipo; en los mixes, el nombre del bando. Empate: won = null.
  const items = rows.map(({ team1_name, team2_name, event_id, event_name, stage, phase, grp, round, last_round, ...m }) => {
    const last = new Map<string, number>();
    if (stage && last_round !== null) last.set(`${stage}:${phase ?? 1}`, last_round);
    return {
      ...m,
      kind: m.kind as 'mix' | 'pcw' | 'official',
      side1_name: m.side1_name ?? team1_name,
      side2_name: m.side2_name ?? team2_name,
      event: event_id ? { id: event_id, name: event_name ?? '' } : null,
      label: event_id ? stageLabel({ stage, phase, grp, round }, last) : null,
    };
  });
  return envelope(items, total, p);
}

export const players = createRouter()
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('player_overview').select(OVERVIEW, { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    if (p.team) q = q.contains('teams', JSON.stringify([{ id: p.team }]));
    if (p.has_account !== undefined) q = q.eq('has_account', p.has_account);
    if (p.has_steam !== undefined) q = q.eq('has_steam', p.has_steam);
    if (p.elo_min !== undefined) q = q.gte('elo', p.elo_min);
    if (p.elo_max !== undefined) q = q.lte('elo', p.elo_max);
    const { rows, total } = await runList<OverviewRow, typeof q>(q, p, { alias: 'nick' });
    const vip = await vipPlayers(c.var.sb, rows.map((r) => r.id!));
    return c.json(envelope(rows.map((r) => toSummary(r, vip)), total, p), 200);
  })
  .openapi(detail, async (c) => {
    const sb = c.var.sb;
    const id = await resolvePlayer(sb, c.req.valid('param').id);
    const [overview, player] = await Promise.all([
      sb.from('player_overview').select(OVERVIEW).eq('id', id).maybeSingle().then(must),
      sb.from('players').select('user_id, steam_id, bio, achievements, team_history, privacy').eq('id', id).maybeSingle().then(must),
    ]);
    const steams = player ? mustHave(await sb.from('player_steam_all').select('steam_id, is_primary').eq('player_id', id)) : [];
    if (!overview || !player) throw notFound('ese jugador');
    // Los SteamID nunca salen en el perfil público: solo para el dueño y los admins.
    const user = currentUser(c);
    const seesSteam = !!user && (user.id === player.user_id || (await isAdmin(c)));
    const [stats, clutchRows, details, ban, vip] = await Promise.all([
      sb.from('player_stats').select('maps, rounds, kills, deaths, assists, damage, rating, kd, hs, adr, wins, losses, k2, k3, k4, k5, first_kills, first_deaths, plants, defuses').eq('player_id', id).maybeSingle().then(must),
      sb.from('player_clutches').select('vs, won').eq('player_id', id).then(mustHave),
      player.user_id ? sb.from('profile_details').select(DETAILS).eq('user_id', player.user_id).maybeSingle().then(must) : Promise.resolve(null),
      activeBan(sb, { player: id }),
      vipPlayers(sb, [id]),
    ]);
    return c.json(
      {
        ...toSummary(overview, vip),
        steam_id: seesSteam ? player.steam_id : null,
        steam_ids: seesSteam
          ? steams.sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || (a.steam_id ?? '').localeCompare(b.steam_id ?? '')).map((s) => s.steam_id ?? '')
          : [],
        bio: player.bio,
        achievements: player.achievements,
        team_history_text: player.team_history,
        privacy: player.privacy === 'private' ? ('private' as const) : ('public' as const),
        peak_elo: overview.peak_elo,
        stats: stats ? { ...stats, clutches: clutchesOf(clutchRows) } : null,
        details: details ?? null,
        private: !!player.user_id && !details,
        ban,
      },
      200,
    );
  })
  .openapi(matches, async (c) => {
    const id = await resolvePlayer(c.var.sb, c.req.valid('param').id);
    const p = c.req.valid('query');
    return c.json((await playerMatches(c.var.sb, id, p)) as never, 200);
  })
  .openapi(myMatches, async (c) => {
    const p = c.req.valid('query');
    const me = must(await c.var.sb.from('players').select('id').eq('user_id', c.var.user.id).maybeSingle());
    if (!me) return c.json(envelope([], 0, p) as never, 200);
    return c.json((await playerMatches(c.var.sb, me.id, p)) as never, 200);
  })
  .openapi(mapStats, async (c) => {
    const id = await resolvePlayer(c.var.sb, c.req.valid('param').id);
    const p = c.req.valid('query');
    let q = c.var.sb.from('player_map_stats').select('map_name, maps, rating, kd, adr, wins, losses', { count: 'exact' }).eq('player_id', id);
    if (p.map) q = q.ilike('map_name', `%${searchTerm(p.map) ?? ''}%`);
    type Row = { map_name: string | null; maps: number | null; rating: number | null; kd: number | null; adr: number | null; wins: number | null; losses: number | null };
    const { rows, total } = await runList<Row, typeof q>(q, p, {}, 'map_name');
    return c.json(envelope(rows.map(({ map_name, ...m }) => ({ map: map_name ?? '?', ...m })), total, p), 200);
  })
  .openapi(medals, async (c) => {
    const id = await resolvePlayer(c.var.sb, c.req.valid('param').id);
    const p = c.req.valid('query');
    const q = c.var.sb
      .from('player_medals')
      .select('id, title, icon, created_at, rank, season:seasons(id, number, name)', { count: 'exact' })
      .eq('player_id', id);
    type Row = { id: string; title: string; icon: string | null; created_at: string; rank: number | null;
                 season: { id: string; number: number; name: string } | null };
    const { rows, total } = await runList<Row, typeof q>(q, p, {});
    return c.json(envelope(rows.map((r) => ({ ...r, season: r.season ?? null, rank: r.rank ?? null })), total, p), 200);
  })
  .openapi(teams, async (c) => {
    const id = await resolvePlayer(c.var.sb, c.req.valid('param').id);
    const p = c.req.valid('query');
    let q = c.var.sb
      .from('team_members_view')
      .select('team_id, team_name, team_tag, role, is_captain, joined_at, left_at', { count: 'exact' })
      .eq('player_id', id)
      .eq('team_kind', 'official');
    if (p.active !== undefined) q = q.eq('active', p.active);
    type Row = {
      team_id: string; team_name: string; team_tag: string | null; role: string; is_captain: boolean | null;
      joined_at: string | null; left_at: string | null;
    };
    const { rows, total } = await runList<Row, typeof q>(q, p, { name: 'team_name' }, 'team_id');
    return c.json(
      envelope(
        rows.map((r) => ({
          team: { id: r.team_id, name: r.team_name, tag: r.team_tag },
          role: r.role,
          is_captain: r.is_captain ?? false,
          joined_at: r.joined_at,
          left_at: r.left_at,
        })),
        total,
        p,
      ),
      200,
    );
  })
  .openapi(eloHistory, async (c) => {
    const id = await resolvePlayer(c.var.sb, c.req.valid('param').id);
    const p = c.req.valid('query');
    const q = c.var.sb
      .from('player_elo_history')
      .select('match_id, map, at, elo_before, elo_after, elo_delta', { count: 'exact' })
      .eq('player_id', id);
    type Row = { match_id: string | null; map: string | null; at: string | null; elo_before: number | null; elo_after: number | null; elo_delta: number | null };
    const { rows, total } = await runList<Row, typeof q>(q, p, {}, 'match_id');
    return c.json(envelope(rows.map((r) => ({ ...r, match_id: r.match_id!, elo_after: r.elo_after ?? 0 })), total, p), 200);
  })
  .openapi(titles, async (c) => {
    const id = await resolvePlayer(c.var.sb, c.req.valid('param').id);
    const p = c.req.valid('query');
    let q = c.var.sb
      .from('player_titles')
      .select('event_id, event_name, result, team_id, team_name, team_tag, at', { count: 'exact' })
      .eq('player_id', id);
    if (p.result) q = q.eq('result', p.result);
    type Row = {
      event_id: string | null; event_name: string | null; result: string | null; team_id: string | null; team_name: string | null;
      team_tag: string | null; at: string | null;
    };
    const { rows, total } = await runList<Row, typeof q>(q, p, { event: 'event_name' }, 'event_id');
    return c.json(
      envelope(
        rows.map((r) => ({
          event: { id: r.event_id!, name: r.event_name ?? '' },
          result: r.result as 'champion' | 'runner_up',
          team: { id: r.team_id!, name: r.team_name ?? '', tag: r.team_tag },
          at: r.at,
        })),
        total,
        p,
      ),
      200,
    );
  })
  .openapi(medalSummary, async (c) => {
    const id = await resolvePlayer(c.var.sb, c.req.valid('param').id);
    const p = c.req.valid('query');
    // Son pocas por jugador: se agrupan, ordenan y paginan acá.
    const rows = mustHave(await c.var.sb.from('player_medals').select('title, icon, created_at').eq('player_id', id));
    const groups = new Map<string, { title: string; icon: string | null; count: number; last_at: string }>();
    for (const r of rows) {
      const k = JSON.stringify([r.title, r.icon]);
      const g = groups.get(k);
      if (!g) groups.set(k, { title: r.title, icon: r.icon, count: 1, last_at: r.created_at });
      else {
        g.count++;
        if (r.created_at > g.last_at) g.last_at = r.created_at;
      }
    }
    const dir = p.order === 'asc' ? 1 : -1;
    const by = (a: { title: string; count: number; last_at: string }, b: typeof a) =>
      p.sort === 'title' ? a.title.localeCompare(b.title) : p.sort === 'last_at' ? a.last_at.localeCompare(b.last_at) : a.count - b.count;
    const items = [...groups.values()].sort((a, b) => dir * by(a, b) || a.title.localeCompare(b.title));
    const from = (p.page - 1) * p.per;
    return c.json(envelope(items.slice(from, from + p.per), items.length, p), 200);
  });
