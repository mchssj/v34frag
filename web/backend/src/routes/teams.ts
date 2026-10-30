import { createRoute, type z } from '@hono/zod-openapi';
import { bodyLimit } from 'hono/body-limit';
import { currentUser, isAdmin, optionalUser, requireUser } from '../lib/auth';
import { levelOf, must, mustHave, notFound, searchTerm } from '../lib/db';
import { AppError, fromPostgrest } from '../lib/errors';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import { LOGO_MAX_BYTES, LOGO_SHAPE } from '../lib/uploads';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  LOGO_HELP,
  LogoUpload,
  LogoResult,
  MemberList,
  MemberQuery,
  MyTeam,
  Ranking,
  RankingQuery,
  TeamDetail,
  TeamEventList,
  TeamEventQuery,
  TeamList,
  TeamListQuery,
  TeamParam,
  TeamPatch,
  type RosterRole,
  type TeamEventResult,
  type TeamSummary,
} from '../schemas/teams';
import { dropPhoto, removePhoto, savePhoto } from '../services/photos';

const OVERVIEW =
  'id, name, tag, kind, captain_id, captain_player_id, captain_nick, members, parent_team_id, logo_url, looking_for, max_members, founded_at, events_played';

type OverviewRow = {
  id: string | null; name: string | null; tag: string | null; kind: string | null; captain_player_id: string | null;
  captain_nick: string | null; members: number | null; parent_team_id: string | null; logo_url: string | null;
  looking_for: string[] | null; max_members: number | null;
};

const toSummary = (t: OverviewRow): z.infer<typeof TeamSummary> => ({
  id: t.id!,
  name: t.name ?? '',
  tag: t.tag,
  kind: t.kind === 'pcw' ? 'pcw' : 'official',
  captain: t.captain_player_id ? { player_id: t.captain_player_id, alias: t.captain_nick ?? '' } : null,
  members: t.members ?? 0,
  max_members: t.kind === 'pcw' ? null : t.max_members,
  plays_as: t.parent_team_id,
  logo_url: t.logo_url,
  looking_for: (t.looking_for ?? []) as z.infer<typeof RosterRole>[],
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
  description:
    'Con `active=true`, el plantel actual (el capitán marcado); con `active=false`, los ex integrantes. `game_role` es el puesto que cada ' +
    'jugador eligió en su perfil (para la tarjeta "Roles de equipo"). Sin sesión.',
  middleware: [optionalUser] as const,
  request: { params: TeamParam, query: MemberQuery },
  responses: { 200: { description: 'Integrantes', ...json(MemberList) }, ...errorResponses(400, 401) },
});

const patchTeam = createRoute({
  method: 'patch',
  path: '/api/v1/teams/{id}',
  tags: ['Equipos'],
  summary: 'Editar mi equipo',
  description: 'El capitán o un admin. Por ahora, qué busca el equipo (`looking_for`). El nombre y la sigla los cambia un admin.',
  security: bearer,
  middleware: [requireUser] as const,
  request: { params: TeamParam, body: { required: true, ...json(TeamPatch) } },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 403, 404) },
});

const logoLimit = bodyLimit({
  maxSize: LOGO_MAX_BYTES + 16 * 1024,
  onError: () => {
    throw new AppError(413, 'FILE_TOO_LARGE', `La imagen pesa más de ${LOGO_MAX_BYTES / 1024} KB.`);
  },
});

const putLogo = createRoute({
  method: 'put',
  path: '/api/v1/teams/{id}/logo',
  tags: ['Equipos'],
  summary: 'Subir el logo',
  description: `\`multipart/form-data\`, campo \`file\`. El capitán o un admin. Reemplaza al anterior. ${LOGO_HELP}`,
  security: bearer,
  middleware: [requireUser, logoLimit] as const,
  request: { params: TeamParam, body: { required: true, content: { 'multipart/form-data': { schema: LogoUpload } } } },
  responses: { 200: { description: 'Logo guardado', ...json(LogoResult) }, ...errorResponses(400, 401, 403, 404, 413) },
});

const deleteLogo = createRoute({
  method: 'delete',
  path: '/api/v1/teams/{id}/logo',
  tags: ['Equipos'],
  summary: 'Quitar el logo',
  description: 'El capitán o un admin. El escudo vuelve a mostrar la sigla.',
  security: bearer,
  middleware: [requireUser] as const,
  request: { params: TeamParam },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 403, 404) },
});

const teamEvents = createRoute({
  method: 'get',
  path: '/api/v1/teams/{id}/events',
  tags: ['Equipos'],
  summary: 'Torneos del equipo',
  description:
    'Los torneos en los que está o estuvo inscrito (sin los cancelados), del más reciente al más viejo, con hasta dónde llegó. ' +
    '`total` cuenta también los que tienen las inscripciones abiertas (`record.events_played` en el detalle cuenta solo los en curso o terminados). Sin sesión.',
  middleware: [optionalUser] as const,
  request: { params: TeamParam, query: TeamEventQuery },
  responses: { 200: { description: 'Torneos', ...json(TeamEventList) }, ...errorResponses(400, 401, 404) },
});

const myTeams = createRoute({
  method: 'get',
  path: '/api/v1/me/teams',
  tags: ['Equipos'],
  summary: 'Mis equipos',
  description: 'Equipos oficiales donde está hoy, con su rol: `leader` si es el capitán; si no, su estado en el roster.',
  security: bearer,
  middleware: [requireUser] as const,
  responses: { 200: { description: 'Equipos', ...json(MyTeam.array()) }, ...errorResponses(401) },
});

const ranking = createRoute({
  method: 'get',
  path: '/api/v1/ranking/teams',
  tags: ['Ranking'],
  summary: 'Ranking de equipos',
  description:
    'Equipos oficiales ordenados por puntos. Cada partida de torneo ganada suma `points.official`. Con `pcw=1` ' +
    'también suma `points.pcw` por cada PCW ganada jugando como el equipo. Los puntos los configura el admin. ' +
    'Desempate: más victorias y después menos derrotas. `trend` compara con la posición de hace 30 días; `form`, los últimos 5 resultados.',
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
    if (p.has_space !== undefined) q = q.eq('has_space', p.has_space);
    if (p.looking_for) q = q.overlaps('looking_for', p.looking_for);
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
        founded_at: team.founded_at,
        record: s
          ? {
              official: { played: s.official_played ?? 0, won: s.official_won ?? 0, lost: s.official_lost ?? 0, points: s.official_points ?? 0 },
              pcw: { played: s.pcw_played ?? 0, won: s.pcw_won ?? 0, lost: s.pcw_lost ?? 0, points: s.pcw_points ?? 0 },
              events_played: team.events_played ?? 0,
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
      .select('player_id, alias, photo_url, has_steam, elo, role, game_role, is_captain, joined_at, left_at', { count: 'exact' })
      .eq('team_id', id);
    if (p.active !== undefined) q = q.eq('active', p.active);
    if (p.role) q = q.eq('role', p.role);
    type Row = {
      player_id: string; alias: string; photo_url: string | null; has_steam: boolean; elo: number | null; role: string;
      game_role: string | null; is_captain: boolean; joined_at: string | null; left_at: string | null;
    };
    const { rows, total } = await runList<Row, typeof q>(q, p, {}, 'player_id');
    return c.json(envelope(rows.map((r) => ({ ...r, level: levelOf(r.elo) })), total, p), 200);
  })
  .openapi(patchTeam, async (c) => {
    const { id } = c.req.valid('param');
    if (!must(await c.var.sb.from('teams').select('id').eq('id', id).maybeSingle())) throw notFound('ese equipo');
    must(await c.var.sb.rpc('team_update', { p_team: id, p_looking_for: c.req.valid('json').looking_for }));
    return c.body(null, 204);
  })
  .openapi(putLogo, async (c) => {
    const { id } = c.req.valid('param');
    const sb = c.var.sb;
    const team = must(await sb.from('teams').select('captain_id, kind, logo_url').eq('id', id).maybeSingle());
    if (!team || team.kind !== 'official') throw notFound('ese equipo');
    if (team.captain_id !== c.var.user.id && !(await isAdmin(c))) throw new AppError(403, 'FORBIDDEN', 'Solo el capitán o un admin cambia el logo.');
    const { url, path } = await savePhoto(c, `teams/${id}`, c.req.valid('form').file, LOGO_MAX_BYTES, LOGO_SHAPE);
    const saved = await sb.rpc('team_set_logo', { p_team: id, p_url: url });
    if (saved.error) {
      await dropPhoto(c, path);
      throw fromPostgrest(saved.error);
    }
    removePhoto(c, team.logo_url);
    return c.json({ logo_url: url }, 200);
  })
  .openapi(deleteLogo, async (c) => {
    const { id } = c.req.valid('param');
    const team = must(await c.var.sb.from('teams').select('logo_url').eq('id', id).maybeSingle());
    if (!team) throw notFound('ese equipo');
    // p_url null quita el logo (los tipos generados no admiten null en los argumentos).
    must(await c.var.sb.rpc('team_set_logo', { p_team: id, p_url: null as unknown as string }));
    removePhoto(c, team.logo_url);
    return c.body(null, 204);
  })
  .openapi(teamEvents, async (c) => {
    const { id } = c.req.valid('param');
    const p = c.req.valid('query');
    if (!must(await c.var.sb.from('teams').select('id').eq('id', id).maybeSingle())) throw notFound('ese equipo');
    const rows = mustHave(await c.var.sb.rpc('team_event_history', { p_team: id }));
    // La función ya ordena del más reciente al más viejo; `order=asc` la invierte.
    const all = p.order === 'asc' ? [...rows].reverse() : rows;
    const items = all.slice((p.page - 1) * p.per, p.page * p.per).map((r) => ({
      event: { id: r.event_id, name: r.name, template: r.template, status: r.status, starts_on: r.starts_on, ends_on: r.ends_on },
      result: r.result as z.infer<typeof TeamEventResult>,
      place: r.place,
      played: r.played,
      won: r.won,
      lost: r.lost,
    }));
    return c.json(envelope(items, all.length, p), 200);
  })
  .openapi(myTeams, async (c) => {
    const { sb, user } = c.var;
    const mine = must(await sb.from('players').select('id').eq('user_id', user.id).maybeSingle());
    if (!mine) return c.json([], 200);
    const rows = mustHave(
      await sb
        .from('team_members_view')
        .select('team_id, team_name, team_tag, team_logo_url, role, is_captain')
        .eq('player_id', mine.id)
        .eq('active', true)
        .eq('team_kind', 'official')
        .order('team_name'),
    );
    return c.json(
      rows.map((r) => ({
        id: r.team_id!,
        name: r.team_name ?? '',
        tag: r.team_tag,
        logo_url: r.team_logo_url,
        my_role: r.is_captain ? ('leader' as const) : ((r.role ?? 'player') as 'player' | 'sub' | 'coach'),
      })),
      200,
    );
  })
  .openapi(ranking, async (c) => {
    const p = c.req.valid('query');
    const sb = c.var.sb;
    const mode = p.pcw ? 'total' : 'official';
    let q = sb
      .from('team_ranking')
      .select(
        'team_id, name, tag, logo_url, official_played, official_won, official_lost, official_points, total_played, total_won, total_lost, total_points, ' +
          'official_position, total_position, official_position_prev, total_position_prev, form_official, form_total',
        { count: 'exact' },
      );
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    type Row = Record<string, number | null> & {
      team_id: string; name: string; tag: string | null; logo_url: string | null; form_official: string[] | null; form_total: string[] | null;
    };
    const { rows, total } = await runList<Row, typeof q>(q, p, RANK_COLUMNS[mode], 'team_id');
    const cfg = must(await sb.from('ranking_config').select('win_official, win_pcw').eq('id', 1).maybeSingle());
    const items = rows.map((r) => {
      const position = r[`${mode}_position`] ?? 0;
      const prev = r[`${mode}_position_prev`] ?? null;
      const played = r[`${mode}_played`] ?? 0;
      const won = r[`${mode}_won`] ?? 0;
      return {
        position,
        team: { id: r.team_id, name: r.name, tag: r.tag, logo_url: r.logo_url },
        played,
        won,
        lost: r[`${mode}_lost`] ?? 0,
        points: r[`${mode}_points`] ?? 0,
        win_rate: played ? Math.round((won * 1000) / played) / 10 : null,
        trend: prev === null ? null : prev - position,
        form: ((mode === 'total' ? r.form_total : r.form_official) ?? []).filter((x): x is 'W' | 'L' => x === 'W' || x === 'L'),
      };
    });
    return c.json({ ...envelope(items, total, p), pcw: p.pcw, points_per_win: { official: cfg?.win_official ?? 30, pcw: cfg?.win_pcw ?? 5 } }, 200);
  });
