import { createRoute, z } from '@hono/zod-openapi';
import { optionalUser } from '../lib/auth';
import { levelOf, must, mustHave, notFound, PageQuery, pageRange, searchTerm } from '../lib/db';
import { createRouter } from '../lib/router';
import { errorResponses, json } from '../schemas/common';
import {
  IdParam,
  PlayerDetail,
  PlayerList,
  PlayerListQuery,
  PlayerMatchList,
  type PlayerSummary,
} from '../schemas/players';

const OVERVIEW = 'id, nick, has_account, has_steam, photo_url, privacy, elo, peak_elo, elo_matches, maps, rating, kd, wins, losses, teams';
const MATCH_FIELDS =
  'match_id, kind, played_at, map, side1_name, side2_name, team1_name, team2_name, score1, score2, side, won, parent_match_id, game_nick, kills, deaths, assists, headshots, damage, rounds, rating, elo_before, elo_after, elo_delta, demo_status';
const DETAILS = 'avatar_url, real_name, country, game_role, steam, faceit, discord, joined_at, last_seen';

type OverviewRow = {
  id: string | null; nick: string | null; has_account: boolean | null; has_steam: boolean | null; photo_url: string | null;
  elo: number | null; elo_matches: number | null; maps: number | null; rating: number | null; kd: number | null;
  wins: number | null; losses: number | null; teams: unknown;
};

export const toSummary = (r: OverviewRow): z.infer<typeof PlayerSummary> => ({
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
});

// ---------- rutas ----------

const list = createRoute({
  method: 'get',
  path: '/api/v1/players',
  tags: ['Jugadores'],
  summary: 'Jugadores',
  description:
    'Listado paginado, por defecto ordenado por ELO (el ranking de jugadores). Sin sesión. ' +
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
    'Datos, ELO, stats, stats por mapa, medallas, equipos actuales e historial. Los datos personales (`details`) ' +
    'solo vienen si el perfil es público, si es el propio o si quien consulta es admin.',
  middleware: [optionalUser] as const,
  request: { params: IdParam },
  responses: { 200: { description: 'Ficha', ...json(PlayerDetail) }, ...errorResponses(400, 401, 404) },
});

const matches = createRoute({
  method: 'get',
  path: '/api/v1/players/{id}/matches',
  tags: ['Jugadores'],
  summary: 'Partidas de un jugador',
  description: 'Partidas terminadas que jugó en el servidor, la más nueva primero, con sus stats y su cambio de ELO.',
  middleware: [optionalUser] as const,
  request: { params: IdParam, query: PageQuery },
  responses: { 200: { description: 'Partidas', ...json(PlayerMatchList) }, ...errorResponses(400, 401) },
});

export const players = createRouter()
  .openapi(list, async (c) => {
    const { q, sort, page, per } = c.req.valid('query');
    const { from, to } = pageRange({ page, per });
    let query = c.var.sb.from('player_overview').select(OVERVIEW, { count: 'exact' });
    const term = searchTerm(q);
    if (term) query = query.ilike('search', `%${term}%`);
    query =
      sort === 'alias'
        ? query.order('nick', { ascending: true })
        : query.order('elo', { ascending: false, nullsFirst: false }).order('nick', { ascending: true });
    const { data, error, count } = await query.range(from, to);
    if (error) must({ data, error });
    return c.json({ items: (data ?? []).map(toSummary), total: count ?? 0, page, per }, 200);
  })
  .openapi(detail, async (c) => {
    const { id } = c.req.valid('param');
    const sb = c.var.sb;
    const [overview, player] = await Promise.all([
      sb.from('player_overview').select(OVERVIEW).eq('id', id).maybeSingle().then(must),
      sb.from('players').select('user_id, steam_id, bio, achievements, team_history, privacy').eq('id', id).maybeSingle().then(must),
    ]);
    if (!overview || !player) throw notFound('ese jugador');

    const [stats, mapStats, medals, history, details] = await Promise.all([
      sb.from('player_stats').select('maps, rounds, kills, deaths, assists, damage, rating, kd, hs, adr, wins, losses').eq('player_id', id).maybeSingle().then(must),
      sb.from('player_map_stats').select('map_name, maps, rating, kd, adr, wins, losses').eq('player_id', id).order('maps', { ascending: false }).then(mustHave),
      sb.from('player_medals').select('id, title, icon, created_at').eq('player_id', id).order('created_at').then(mustHave),
      sb.from('team_members')
        .select('role, joined_at, left_at, team:teams!inner(id, name, tag, kind)')
        .eq('player_id', id)
        .eq('team.kind', 'official')
        .order('left_at', { ascending: false, nullsFirst: true })
        .order('joined_at', { ascending: false, nullsFirst: false })
        .then(mustHave),
      player.user_id
        ? sb.from('profile_details').select(DETAILS).eq('user_id', player.user_id).maybeSingle().then(must)
        : Promise.resolve(null),
    ]);

    const privacy = player.privacy === 'private' ? 'private' : 'public';
    return c.json(
      {
        ...toSummary(overview),
        steam_id: player.steam_id,
        bio: player.bio,
        achievements: player.achievements,
        team_history_text: player.team_history,
        privacy,
        peak_elo: overview.peak_elo,
        stats: stats ?? null,
        map_stats: mapStats.map(({ map_name, ...m }) => ({ map: map_name ?? '?', ...m })),
        medals,
        history: history.map((h) => ({
          team: { id: h.team.id, name: h.team.name, tag: h.team.tag },
          role: h.role,
          joined_at: h.joined_at,
          left_at: h.left_at,
        })),
        details: details ?? null,
        private: !!player.user_id && !details,
      },
      200,
    );
  })
  .openapi(matches, async (c) => {
    const { id } = c.req.valid('param');
    const { page, per } = c.req.valid('query');
    const { from, to } = pageRange({ page, per });
    const { data, error, count } = await c.var.sb
      .from('player_matches')
      .select(MATCH_FIELDS, { count: 'exact' })
      .eq('player_id', id)
      .order('played_at', { ascending: false, nullsFirst: false })
      .range(from, to);
    if (error) must({ data, error });
    // En PCW y torneos el bando es el equipo; en los mixes, el nombre del bando. Empate: won = null.
    const items = (data ?? []).map(({ team1_name, team2_name, ...m }) => ({
      ...m,
      match_id: m.match_id!,
      kind: m.kind as 'mix' | 'pcw' | 'official',
      side1_name: m.side1_name ?? team1_name,
      side2_name: m.side2_name ?? team2_name,
    }));
    return c.json({ items, total: count ?? 0, page, per }, 200);
  });
