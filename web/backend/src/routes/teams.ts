import { createRoute, type z } from '@hono/zod-openapi';
import { currentUser, isAdmin, optionalUser } from '../lib/auth';
import { levelOf, must, mustHave, notFound, pageRange, searchTerm } from '../lib/db';
import { createRouter } from '../lib/router';
import { errorResponses, json } from '../schemas/common';
import {
  MAX_ROSTER,
  Ranking,
  RankingQuery,
  TeamDetail,
  TeamList,
  TeamListQuery,
  TeamParam,
  type RosterEntry,
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
  description: 'Listado paginado por nombre. Por defecto, los oficiales. Sin sesión.',
  middleware: [optionalUser] as const,
  request: { query: TeamListQuery },
  responses: { 200: { description: 'Equipos', ...json(TeamList) }, ...errorResponses(400, 401) },
});

const detail = createRoute({
  method: 'get',
  path: '/api/v1/teams/{id}',
  tags: ['Equipos'],
  summary: 'Equipo',
  description: 'Datos, capitán, plantel activo, ex integrantes, récord del ranking y últimas partidas. Con sesión, `viewer` dice si es capitán, miembro o admin.',
  middleware: [optionalUser] as const,
  request: { params: TeamParam },
  responses: { 200: { description: 'Equipo', ...json(TeamDetail) }, ...errorResponses(400, 401, 404) },
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

export const teams = createRouter()
  .openapi(list, async (c) => {
    const { kind, q, page, per } = c.req.valid('query');
    const { from, to } = pageRange({ page, per });
    let query = c.var.sb.from('team_overview').select(OVERVIEW, { count: 'exact' }).eq('kind', kind);
    const term = searchTerm(q);
    if (term) query = query.ilike('search', `%${term}%`);
    const { data, error, count } = await query.order('name').range(from, to);
    if (error) must({ data, error });
    return c.json({ items: (data ?? []).map(toSummary), total: count ?? 0, page, per }, 200);
  })
  .openapi(detail, async (c) => {
    const { id } = c.req.valid('param');
    const sb = c.var.sb;
    const team = must(await sb.from('team_overview').select(OVERVIEW).eq('id', id).maybeSingle());
    if (!team) throw notFound('ese equipo');

    const [members, standing, recent] = await Promise.all([
      sb.from('team_members').select('player_id, role, joined_at, left_at').eq('team_id', id).then(mustHave),
      sb.from('team_standings').select('*').eq('team_id', id).maybeSingle().then(must),
      sb.from('matches')
        .select(
          'id, kind, status, starts_at, played_at, score1, score2, winner_side, event_id, stage, team1:teams!matches_team1_fkey(id, name, tag), team2:teams!matches_team2_fkey(id, name, tag)',
        )
        .or(`team1.eq.${id},team2.eq.${id}`)
        .neq('kind', 'mix')
        .order('starts_at', { ascending: false, nullsFirst: false })
        .limit(10)
        .then(mustHave),
    ]);

    const ids = [...new Set(members.map((m) => m.player_id))];
    const people = ids.length
      ? mustHave(await sb.from('player_overview').select('id, nick, photo_url, has_steam, elo').in('id', ids))
      : [];
    const byId = new Map(people.map((p) => [p.id!, p]));
    const entry = (m: (typeof members)[number]): z.infer<typeof RosterEntry> => {
      const p = byId.get(m.player_id);
      return {
        player_id: m.player_id,
        alias: p?.nick ?? '',
        photo_url: p?.photo_url ?? null,
        has_steam: !!p?.has_steam,
        elo: p?.elo ?? null,
        level: levelOf(p?.elo),
        role: m.role,
        is_captain: m.left_at === null && m.player_id === team.captain_player_id,
        joined_at: m.joined_at,
        left_at: m.left_at,
      };
    };
    const roster = members.filter((m) => m.left_at === null).map(entry);
    roster.sort((a, b) => Number(b.is_captain) - Number(a.is_captain) || a.alias.localeCompare(b.alias));
    const former = members.filter((m) => m.left_at !== null).map(entry);
    former.sort((a, b) => (b.left_at ?? '').localeCompare(a.left_at ?? ''));

    let viewer: z.infer<typeof TeamDetail>['viewer'] = null;
    const user = currentUser(c);
    if (user) {
      const mine = must(await sb.from('players').select('id').eq('user_id', user.id).maybeSingle());
      viewer = {
        is_captain: team.captain_id === user.id,
        is_member: !!mine && roster.some((r) => r.player_id === mine.id),
        is_admin: await isAdmin(c),
      };
    }

    const s = standing;
    return c.json(
      {
        ...toSummary(team),
        roster,
        former,
        record: s
          ? {
              official: { played: s.official_played ?? 0, won: s.official_won ?? 0, lost: s.official_lost ?? 0, points: s.official_points ?? 0 },
              pcw: { played: s.pcw_played ?? 0, won: s.pcw_won ?? 0, lost: s.pcw_lost ?? 0, points: s.pcw_points ?? 0 },
            }
          : null,
        recent_matches: recent.map((m) => ({ ...m, kind: m.kind === 'pcw' ? ('pcw' as const) : ('official' as const) })),
        viewer,
      },
      200,
    );
  })
  .openapi(ranking, async (c) => {
    const { pcw } = c.req.valid('query');
    const sb = c.var.sb;
    const [rows, cfg] = await Promise.all([
      sb.from('team_standings').select('*').then(mustHave),
      sb.from('ranking_config').select('win_official, win_pcw').eq('id', 1).maybeSingle().then(must),
    ]);
    const items = rows
      .map((r) => ({
        team: { id: r.team_id!, name: r.name ?? '', tag: r.tag },
        played: (r.official_played ?? 0) + (pcw ? (r.pcw_played ?? 0) : 0),
        won: (r.official_won ?? 0) + (pcw ? (r.pcw_won ?? 0) : 0),
        lost: (r.official_lost ?? 0) + (pcw ? (r.pcw_lost ?? 0) : 0),
        points: (r.official_points ?? 0) + (pcw ? (r.pcw_points ?? 0) : 0),
      }))
      .sort((a, b) => b.points - a.points || b.won - a.won || a.lost - b.lost || a.team.name.localeCompare(b.team.name));
    // Empatados en puntos, victorias y derrotas comparten posición.
    let position = 0;
    const ranked = items.map((it, i) => {
      const prev = items[i - 1];
      if (!prev || prev.points !== it.points || prev.won !== it.won || prev.lost !== it.lost) position = i + 1;
      return { position, ...it };
    });
    return c.json({ pcw, points: { official: cfg?.win_official ?? 30, pcw: cfg?.win_pcw ?? 5 }, items: ranked }, 200);
  });
