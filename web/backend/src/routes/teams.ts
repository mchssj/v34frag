import { createRoute, type z } from '@hono/zod-openapi';
import { currentUser, isAdmin, optionalUser } from '../lib/auth';
import { levelOf, must, notFound, searchTerm } from '../lib/db';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import { errorResponses, json } from '../schemas/common';
import {
  MAX_ROSTER,
  MemberList,
  MemberQuery,
  Ranking,
  RankingQuery,
  TeamDetail,
  TeamList,
  TeamListQuery,
  TeamParam,
  type TeamSummary,
} from '../schemas/teams';

const OVERVIEW = 'id, name, tag, kind, captain_id, captain_player_id, captain_nick, members, parent_team_id';

type OverviewRow = {
  id: string | null; name: string | null; tag: string | null; kind: string | null; captain_player_id: string | null;
  captain_nick: string | null; members: number | null; parent_team_id: string | null;
};

const toSummary = (t: OverviewRow): z.infer<typeof TeamSummary> => ({
  id: t.id!,
  name: t.name ?? '',
  tag: t.tag,
  kind: t.kind === 'pcw' ? 'pcw' : 'official',
  captain: t.captain_player_id ? { player_id: t.captain_player_id, alias: t.captain_nick ?? '' } : null,
  members: t.members ?? 0,
  max_members: t.kind === 'pcw' ? null : MAX_ROSTER,
  plays_as: t.parent_team_id,
});

// ---------- rutas ----------

const list = createRoute({
  method: 'get',
  path: '/api/v1/teams',
  tags: ['Equipos'],
  summary: 'Equipos',
  description: 'Por defecto, los oficiales ordenados por nombre. Sin sesión.',
  middleware: [optionalUser] as const,
  request: { query: TeamListQuery },
  responses: { 200: { description: 'Equipos', ...json(TeamList) }, ...errorResponses(400, 401) },
});

const detail = createRoute({
  method: 'get',
  path: '/api/v1/teams/{id}',
  tags: ['Equipos'],
  summary: 'Equipo',
  description: 'Datos, capitán y récord del ranking. Con sesión, `viewer` dice si es capitán, miembro o admin. El plantel va en /teams/{id}/members y las partidas en /matches?team={id}.',
  middleware: [optionalUser] as const,
  request: { params: TeamParam },
  responses: { 200: { description: 'Equipo', ...json(TeamDetail) }, ...errorResponses(400, 401, 404) },
});

const members = createRoute({
  method: 'get',
  path: '/api/v1/teams/{id}/members',
  tags: ['Equipos'],
  summary: 'Plantel y ex integrantes',
  description: 'Con `active=true`, el plantel actual (el capitán marcado); con `active=false`, los ex integrantes. Sin sesión.',
  middleware: [optionalUser] as const,
  request: { params: TeamParam, query: MemberQuery },
  responses: { 200: { description: 'Integrantes', ...json(MemberList) }, ...errorResponses(400, 401) },
});

const ranking = createRoute({
  method: 'get',
  path: '/api/v1/ranking/teams',
  tags: ['Ranking'],
  summary: 'Ranking de equipos',
  description:
    'Equipos oficiales ordenados por puntos. Cada partida de torneo ganada suma `points.official`. Con `pcw=1` ' +
    'también suma `points.pcw` por cada PCW ganada jugando como el equipo. Los puntos los configura el admin.',
  middleware: [optionalUser] as const,
  request: { query: RankingQuery },
  responses: { 200: { description: 'Ranking', ...json(Ranking) }, ...errorResponses(400, 401) },
});

const RANK_COLUMNS = {
  official: { points: 'official_points', won: 'official_won', played: 'official_played', name: 'name' },
  total: { points: 'total_points', won: 'total_won', played: 'total_played', name: 'name' },
};

export const teams = createRouter()
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('team_overview').select(OVERVIEW, { count: 'exact' }).eq('kind', p.kind);
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    if (p.has_space === true) q = q.lt('members', MAX_ROSTER);
    if (p.has_space === false) q = q.gte('members', MAX_ROSTER);
    const { rows, total } = await runList<OverviewRow, typeof q>(q, p, {});
    return c.json(envelope(rows.map(toSummary), total, p), 200);
  })
  .openapi(detail, async (c) => {
    const { id } = c.req.valid('param');
    const sb = c.var.sb;
    const team = must(await sb.from('team_overview').select(OVERVIEW).eq('id', id).maybeSingle());
    if (!team) throw notFound('ese equipo');
    const s = must(await sb.from('team_standings').select('*').eq('team_id', id).maybeSingle());
    let viewer: z.infer<typeof TeamDetail>['viewer'] = null;
    const user = currentUser(c);
    if (user) {
      const mine = must(await sb.from('players').select('id').eq('user_id', user.id).maybeSingle());
      const member = mine
        ? !!must(await sb.from('team_members').select('id').eq('team_id', id).eq('player_id', mine.id).is('left_at', null).maybeSingle())
        : false;
      viewer = { is_captain: team.captain_id === user.id, is_member: member, is_admin: await isAdmin(c) };
    }
    return c.json(
      {
        ...toSummary(team),
        record: s
          ? {
              official: { played: s.official_played ?? 0, won: s.official_won ?? 0, lost: s.official_lost ?? 0, points: s.official_points ?? 0 },
              pcw: { played: s.pcw_played ?? 0, won: s.pcw_won ?? 0, lost: s.pcw_lost ?? 0, points: s.pcw_points ?? 0 },
            }
          : null,
        viewer,
      },
      200,
    );
  })
  .openapi(members, async (c) => {
    const { id } = c.req.valid('param');
    const p = c.req.valid('query');
    let q = c.var.sb
      .from('team_members_view')
      .select('player_id, alias, photo_url, has_steam, elo, role, is_captain, joined_at, left_at', { count: 'exact' })
      .eq('team_id', id);
    if (p.active !== undefined) q = q.eq('active', p.active);
    if (p.role) q = q.eq('role', p.role);
    type Row = {
      player_id: string; alias: string; photo_url: string | null; has_steam: boolean; elo: number | null; role: string;
      is_captain: boolean; joined_at: string | null; left_at: string | null;
    };
    const { rows, total } = await runList<Row, typeof q>(q, p, {}, 'player_id');
    return c.json(envelope(rows.map((r) => ({ ...r, level: levelOf(r.elo) })), total, p), 200);
  })
  .openapi(ranking, async (c) => {
    const p = c.req.valid('query');
    const sb = c.var.sb;
    const mode = p.pcw ? 'total' : 'official';
    let q = sb
      .from('team_ranking')
      .select('team_id, name, tag, official_played, official_won, official_lost, official_points, total_played, total_won, total_lost, total_points, official_position, total_position', { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    type Row = Record<string, number> & { team_id: string; name: string; tag: string | null };
    const { rows, total } = await runList<Row, typeof q>(q, p, RANK_COLUMNS[mode], 'team_id');
    const cfg = must(await sb.from('ranking_config').select('win_official, win_pcw').eq('id', 1).maybeSingle());
    const items = rows.map((r) => ({
      position: r[`${mode}_position`] ?? 0,
      team: { id: r.team_id, name: r.name, tag: r.tag },
      played: r[`${mode}_played`] ?? 0,
      won: r[`${mode}_won`] ?? 0,
      lost: r[`${mode}_lost`] ?? 0,
      points: r[`${mode}_points`] ?? 0,
    }));
    return c.json({ ...envelope(items, total, p), pcw: p.pcw, points_per_win: { official: cfg?.win_official ?? 30, pcw: cfg?.win_pcw ?? 5 } }, 200);
  });
