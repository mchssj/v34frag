import { createRoute, type z } from '@hono/zod-openapi';
import { currentUser, optionalUser, requireUser } from '../lib/auth';
import { must, mustHave, notFound, searchTerm } from '../lib/db';
import { notModified } from '../lib/etag';
import { AppError } from '../lib/errors';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  EventCreate,
  EventDetail,
  EventList,
  EventListQuery,
  EventMatchList,
  EventMatchQuery,
  EventParam,
  EventPatch,
  EventTeamParam,
  RegistrationBody,
  RegistrationList,
  RegistrationQuery,
  SeedsBody,
  StandingList,
  StandingQuery,
  TieBody,
  type EventSummary,
} from '../schemas/events';
import { Created } from '../schemas/teams';
import { MATCH_LIST, toSummary, type MatchRow } from '../services/matches';

const LIST = 'id, name, template, status, starts_on, ends_on, prize, max_teams, organizer_id, organizer_alias, champion_id, champion_name, champion_tag, teams';
const EXTRA = 'id, rules, min_teams, players_min, players_max, config, tie_pending';
const done = { 204: { description: 'Hecho' } } as const;

type EventRow = {
  id: string; name: string; template: string; status: string; starts_on: string | null; ends_on: string | null; prize: string | null;
  max_teams: number | null; organizer_id: string | null; organizer_alias: string | null; champion_id: string | null;
  champion_name: string | null; champion_tag: string | null; teams: number;
};

const summary = (e: EventRow): z.infer<typeof EventSummary> => ({
  id: e.id,
  name: e.name,
  template: e.template as z.infer<typeof EventSummary>['template'],
  status: e.status as z.infer<typeof EventSummary>['status'],
  starts_on: e.starts_on,
  ends_on: e.ends_on,
  prize: e.prize,
  teams: e.teams ?? 0,
  max_teams: e.max_teams,
  champion: e.champion_id ? { id: e.champion_id, name: e.champion_name ?? '', tag: e.champion_tag } : null,
  organizer: e.organizer_id ? { user_id: e.organizer_id, alias: e.organizer_alias } : null,
});

// ---------- rutas públicas ----------

const list = createRoute({
  method: 'get', path: '/api/v1/events', tags: ['Torneos'], middleware: [optionalUser] as const,
  summary: 'Torneos', description: 'Por defecto, el que empieza más tarde primero. Sin sesión.',
  request: { query: EventListQuery },
  responses: { 200: { description: 'Torneos', ...json(EventList) }, ...errorResponses(400, 401) },
});

const detail = createRoute({
  method: 'get', path: '/api/v1/events/{id}', tags: ['Torneos'], middleware: [optionalUser] as const,
  summary: 'Torneo',
  description: 'Configuración, estado, campeón y empate pendiente. Inscritos, partidas y tablas van en sus listados. Con `ETag` (`304` si no cambió).',
  request: { params: EventParam },
  responses: { 200: { description: 'Torneo', ...json(EventDetail) }, 304: { description: 'Sin cambios' }, ...errorResponses(400, 401, 404) },
});

const registrations = createRoute({
  method: 'get', path: '/api/v1/events/{id}/registrations', tags: ['Torneos'], middleware: [optionalUser] as const,
  summary: 'Equipos inscritos', description: 'Con su siembra y los jugadores que inscribió cada uno.',
  request: { params: EventParam, query: RegistrationQuery },
  responses: { 200: { description: 'Inscritos', ...json(RegistrationList) }, ...errorResponses(400, 401) },
});

const eventMatches = createRoute({
  method: 'get', path: '/api/v1/events/{id}/matches', tags: ['Torneos'], middleware: [optionalUser] as const,
  summary: 'Partidas del torneo',
  description:
    'Para dibujar las llaves: `sort=bracket` (por defecto) ordena por fase, etapa, grupo, ronda y posición; hasta 200 por página. ' +
    'Sin byes salvo `include_byes=true`. Con `ETag`.',
  request: { params: EventParam, query: EventMatchQuery },
  responses: { 200: { description: 'Partidas', ...json(EventMatchList) }, 304: { description: 'Sin cambios' }, ...errorResponses(400, 401) },
});

const standings = createRoute({
  method: 'get', path: '/api/v1/events/{id}/standings', tags: ['Torneos'], middleware: [optionalUser] as const,
  summary: 'Tablas de grupos y del suizo',
  description: 'Con la posición que calcula la base (desempates de grupos; récord, Buchholz y rondas en el suizo). Con `ETag`.',
  request: { params: EventParam, query: StandingQuery },
  responses: { 200: { description: 'Tablas', ...json(StandingList) }, 304: { description: 'Sin cambios' }, ...errorResponses(400, 401) },
});

// ---------- capitán ----------

const register = createRoute({
  method: 'put', path: '/api/v1/events/{id}/registrations/{teamId}', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Inscribir un equipo o cambiar sus inscritos',
  description:
    'El capitán, mientras el torneo está en inscripciones (o el organizador, también después de generar). Los jugadores tienen que ser del ' +
    'plantel, tener SteamID y no estar inscritos con otro equipo en el mismo torneo; entre `players_min` y `players_max`.',
  request: { params: EventTeamParam, body: { required: true, ...json(RegistrationBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

const unregister = createRoute({
  method: 'delete', path: '/api/v1/events/{id}/registrations/{teamId}', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Dar de baja un equipo', description: 'El capitán o el organizador, antes de generar el fixture.',
  request: { params: EventTeamParam },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

// ---------- organizador o admin ----------

const create = createRoute({
  method: 'post', path: '/api/v1/events', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Crear un torneo', description: 'Un organizador o un admin. Queda como organizador quien lo crea.',
  request: { body: { required: true, ...json(EventCreate) } },
  responses: { 201: { description: 'Creado', ...json(Created) }, ...errorResponses(400, 401, 403) },
});

const patch = createRoute({
  method: 'patch', path: '/api/v1/events/{id}', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Editar un torneo', description: 'El formato (plantilla, configuración e inscritos por equipo) solo antes de generar el fixture.',
  request: { params: EventParam, body: { required: true, ...json(EventPatch) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});

const remove = createRoute({
  method: 'delete', path: '/api/v1/events/{id}', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Borrar un torneo', description: 'Solo si no tiene partidas jugadas; si no, se cancela.',
  request: { params: EventParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});

const cancel = createRoute({
  method: 'post', path: '/api/v1/events/{id}/cancel', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Cancelar un torneo', request: { params: EventParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});

const seeds = createRoute({
  method: 'put', path: '/api/v1/events/{id}/seeds', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Orden de siembra', description: 'Lista de equipos inscritos, del cabeza de serie 1 en adelante. Solo antes de generar.',
  request: { params: EventParam, body: { required: true, ...json(SeedsBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});

const generate = createRoute({
  method: 'post', path: '/api/v1/events/{id}/generate', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Generar el fixture',
  description: 'Arma la primera fase según la plantilla y la siembra. Las rondas y fases siguientes, los playoffs y el campeón se arman solos con cada resultado.',
  request: { params: EventParam },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

const reset = createRoute({
  method: 'post', path: '/api/v1/events/{id}/reset', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Reiniciar el fixture', description: 'Solo si no se jugó ninguna partida.',
  request: { params: EventParam },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

const ties = createRoute({
  method: 'post', path: '/api/v1/events/{id}/ties', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Resolver un empate de grupo',
  description: 'Cuando `tie_pending` indica un grupo empatado en todos los criterios: el orden de los equipos, del mejor al peor. Después los playoffs se arman solos.',
  request: { params: EventParam, body: { required: true, ...json(TieBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

export const events = createRouter()
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('event_list').select(LIST, { count: 'exact' });
    if (p.status) q = q.eq('status', p.status);
    if (p.template) q = q.eq('template', p.template);
    if (p.organizer) q = q.eq('organizer_id', p.organizer);
    if (p.from) q = q.gte('starts_on', p.from.slice(0, 10));
    if (p.to) q = q.lte('starts_on', p.to.slice(0, 10));
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    const { rows, total } = await runList<EventRow, typeof q>(q, p, {});
    return c.json(envelope(rows.map(summary), total, p), 200);
  })
  .openapi(detail, async (c) => {
    const { id } = c.req.valid('param');
    const sb = c.var.sb;
    const [e, extra] = await Promise.all([
      sb.from('event_list').select(LIST).eq('id', id).maybeSingle().then(must),
      sb.from('events').select(EXTRA).eq('id', id).maybeSingle().then(must),
    ]);
    if (!e || !extra) throw notFound('ese torneo');
    const user = currentUser(c);
    const viewer = user ? { can_manage: !!must(await sb.rpc('can_manage_event', { p_event: id })) } : null;
    const body = {
      ...summary(e as unknown as EventRow),
      rules: extra.rules,
      min_teams: extra.min_teams,
      players_min: extra.players_min,
      players_max: extra.players_max,
      config: (extra.config ?? {}) as Record<string, unknown>,
      tie_pending: (extra.tie_pending as { grp: number } | null) ?? null,
      viewer,
    };
    if (await notModified(c, body)) return c.body(null, 304);
    return c.json(body, 200);
  })
  .openapi(registrations, async (c) => {
    const { id } = c.req.valid('param');
    const p = c.req.valid('query');
    let q = c.var.sb.from('event_registrations_view').select('team_id, name, tag, seed, start_stage', { count: 'exact' }).eq('event_id', id);
    if (p.start_stage) q = q.eq('start_stage', p.start_stage);
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    type Row = { team_id: string; name: string; tag: string | null; seed: number; start_stage: number };
    const { rows, total } = await runList<Row, typeof q>(q, p, {}, 'team_id');
    const players = rows.length
      ? mustHave(await c.var.sb.from('tournament_registration_players').select('team_id, player:players(id, nick)').eq('event_id', id).in('team_id', rows.map((r) => r.team_id)))
      : [];
    const items = rows.map((r) => ({
      team: { id: r.team_id, name: r.name, tag: r.tag },
      seed: r.seed,
      start_stage: r.start_stage,
      players: players
        .filter((x) => x.team_id === r.team_id && x.player)
        .map((x) => ({ player_id: x.player!.id, alias: x.player!.nick }))
        .sort((a, b) => a.alias.localeCompare(b.alias)),
    }));
    return c.json(envelope(items, total, p), 200);
  })
  .openapi(eventMatches, async (c) => {
    const { id } = c.req.valid('param');
    const p = c.req.valid('query');
    let q = c.var.sb.from('match_list').select(MATCH_LIST, { count: 'exact' }).eq('event_id', id);
    if (!p.include_byes) q = q.eq('bye', false);
    if (p.stage) q = q.eq('stage', p.stage);
    if (p.phase !== undefined) q = q.eq('phase', p.phase);
    if (p.grp !== undefined) q = q.eq('grp', p.grp);
    if (p.round !== undefined) q = q.eq('round', p.round);
    if (p.status) q = q.eq('status', p.status);
    if (p.team) q = q.or(`team1_id.eq.${p.team},team2_id.eq.${p.team}`);
    const { rows, total } = await runList<MatchRow, typeof q>(q, p, { bracket: ['phase', 'stage_order', 'grp', 'round', 'pos'] });
    const body = envelope(
      rows.map((m) => ({ ...toSummary(m), stage: m.stage, phase: m.phase, grp: m.grp, round: m.round, pos: m.pos, bye: m.bye })),
      total,
      p,
    );
    if (await notModified(c, body)) return c.body(null, 304);
    return c.json(body, 200);
  })
  .openapi(standings, async (c) => {
    const { id } = c.req.valid('param');
    const p = c.req.valid('query');
    let q = c.var.sb.from('event_standings').select('*', { count: 'exact' }).eq('event_id', id);
    if (p.stage) q = q.eq('stage', p.stage);
    if (p.grp !== undefined) q = q.eq('grp', p.grp);
    if (p.phase !== undefined) q = q.eq('phase', p.phase);
    type Row = {
      stage: string; grp: number; phase: number; team_id: string; name: string; tag: string | null; place: number; tied: boolean;
      played: number; won: number; lost: number; points: number | null; rounds_for: number | null; rounds_against: number | null;
      rounds_diff: number; buchholz: number | null; state: string | null;
    };
    const { rows, total } = await runList<Row, typeof q>(q, p, { place: ['stage', 'phase', 'grp', 'place'] }, 'team_id');
    const body = envelope(
      rows.map((r) => ({
        stage: r.stage as 'group' | 'swiss', grp: r.grp, phase: r.phase, team: { id: r.team_id, name: r.name, tag: r.tag },
        place: r.place, tied: !!r.tied, played: r.played ?? 0, won: r.won ?? 0, lost: r.lost ?? 0, points: r.points,
        rounds_for: r.rounds_for, rounds_against: r.rounds_against, rounds_diff: r.rounds_diff ?? 0, buchholz: r.buchholz,
        state: r.state as 'active' | 'qualified' | 'eliminated' | null,
      })),
      total,
      p,
    );
    if (await notModified(c, body)) return c.body(null, 304);
    return c.json(body, 200);
  })
  .openapi(register, async (c) => {
    const { id, teamId } = c.req.valid('param');
    const { players, start_stage } = c.req.valid('json');
    must(await c.var.sb.rpc('event_register', { p_event: id, p_team: teamId, p_players: players, p_start_stage: start_stage }));
    return c.body(null, 204);
  })
  .openapi(unregister, async (c) => {
    const { id, teamId } = c.req.valid('param');
    must(await c.var.sb.rpc('event_unregister', { p_event: id, p_team: teamId }));
    return c.body(null, 204);
  })
  .openapi(create, async (c) => {
    const body = c.req.valid('json');
    const r = await c.var.sb.from('events').insert({ ...body, config: (body.config ?? {}) as never }).select('id').single();
    if (r.error?.code === '42501') throw new AppError(403, 'FORBIDDEN', 'Solo un organizador o un admin puede crear torneos.');
    return c.json({ id: mustHave(r).id }, 201);
  })
  .openapi(patch, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const rows = mustHave(await c.var.sb.from('events').update({ ...body, config: body.config as never }).eq('id', id).select('id'));
    if (!rows.length) throw new AppError(403, 'FORBIDDEN', 'Solo el organizador del torneo o un admin puede editarlo.');
    return c.body(null, 204);
  })
  .openapi(remove, async (c) => {
    const rows = mustHave(await c.var.sb.from('events').delete().eq('id', c.req.valid('param').id).select('id'));
    if (!rows.length) throw new AppError(403, 'FORBIDDEN', 'Solo el organizador del torneo o un admin puede borrarlo.');
    return c.body(null, 204);
  })
  .openapi(cancel, async (c) => {
    const rows = mustHave(await c.var.sb.from('events').update({ status: 'cancelled' }).eq('id', c.req.valid('param').id).select('id'));
    if (!rows.length) throw new AppError(403, 'FORBIDDEN', 'Solo el organizador del torneo o un admin puede cancelarlo.');
    return c.body(null, 204);
  })
  .openapi(seeds, async (c) => {
    const { id } = c.req.valid('param');
    const { teams } = c.req.valid('json');
    const regs = mustHave(await c.var.sb.from('tournament_registrations').select('team_id').eq('event_id', id)).map((r) => r.team_id!);
    if (teams.length !== regs.length || teams.some((t) => !regs.includes(t))) {
      throw new AppError(400, 'VALIDATION_ERROR', 'La siembra tiene que tener exactamente los equipos inscritos.');
    }
    const rows = mustHave(await c.var.sb.from('events').update({ seeds: teams }).eq('id', id).select('id'));
    if (!rows.length) throw new AppError(403, 'FORBIDDEN', 'Solo el organizador del torneo o un admin cambia la siembra.');
    return c.body(null, 204);
  })
  .openapi(generate, async (c) => {
    must(await c.var.sb.rpc('event_generate', { p_event: c.req.valid('param').id }));
    return c.body(null, 204);
  })
  .openapi(reset, async (c) => {
    must(await c.var.sb.rpc('event_reset', { p_event: c.req.valid('param').id }));
    return c.body(null, 204);
  })
  .openapi(ties, async (c) => {
    const { grp, order } = c.req.valid('json');
    must(await c.var.sb.rpc('event_resolve_tie', { p_event: c.req.valid('param').id, p_grp: grp, p_order: order }));
    return c.body(null, 204);
  });
