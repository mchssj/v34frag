import { createRoute, type z } from '@hono/zod-openapi';
import { currentUser, optionalUser, requireUser } from '../lib/auth';
import { must, mustHave, notFound, pageRange } from '../lib/db';
import { notModified } from '../lib/etag';
import { AppError } from '../lib/errors';
import { createRouter } from '../lib/router';
import type { Db } from '../lib/supabase';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  EventCreate,
  EventDetail,
  EventList,
  EventListQuery,
  EventParam,
  EventPatch,
  EventTeamParam,
  RegistrationBody,
  SeedsBody,
  TieBody,
  type EventSummary,
} from '../schemas/events';
import { Created } from '../schemas/teams';
import { eventRounds, MATCH_LIST, toSummary, type MatchRow } from '../services/matches';

const EVENT = 'id, name, template, status, starts_on, ends_on, prize, max_teams, min_teams, rules, players_min, players_max, config, tie_pending, seeds, organizer_id, champion:teams!events_champion_fkey(id, name, tag)';
const done = { 204: { description: 'Hecho' } } as const;

type EventRow = {
  id: string; name: string; template: string; status: string; starts_on: string | null; ends_on: string | null; prize: string | null;
  max_teams: number | null; min_teams: number | null; rules: string | null; players_min: number; players_max: number; config: unknown;
  tie_pending: unknown; seeds: string[]; organizer_id: string | null; champion: { id: string; name: string; tag: string | null } | null;
};

async function organizerAliases(sb: Db, ids: (string | null)[]) {
  const users = [...new Set(ids.filter((x): x is string => !!x))];
  if (!users.length) return new Map<string, string>();
  return new Map(mustHave(await sb.from('players').select('user_id, nick').in('user_id', users)).map((p) => [p.user_id!, p.nick]));
}

const summary = (e: EventRow, teams: number, aliases: Map<string, string>): z.infer<typeof EventSummary> => ({
  id: e.id,
  name: e.name,
  template: e.template as z.infer<typeof EventSummary>['template'],
  status: e.status as z.infer<typeof EventSummary>['status'],
  starts_on: e.starts_on,
  ends_on: e.ends_on,
  prize: e.prize,
  teams,
  max_teams: e.max_teams,
  champion: e.champion,
  organizer: e.organizer_id ? { user_id: e.organizer_id, alias: aliases.get(e.organizer_id) ?? null } : null,
});

// ---------- rutas públicas ----------

const list = createRoute({
  method: 'get', path: '/api/v1/events', tags: ['Torneos'], middleware: [optionalUser] as const,
  summary: 'Torneos', description: 'El más nuevo primero. Sin sesión.',
  request: { query: EventListQuery },
  responses: { 200: { description: 'Torneos', ...json(EventList) }, ...errorResponses(400, 401) },
});

const detail = createRoute({
  method: 'get', path: '/api/v1/events/{id}', tags: ['Torneos'], middleware: [optionalUser] as const,
  summary: 'Torneo',
  description: 'Configuración, inscritos con sus jugadores, tablas de grupos y del suizo, partidas (llaves) y campeón. Con `ETag` (`304` si no cambió).',
  request: { params: EventParam },
  responses: { 200: { description: 'Torneo', ...json(EventDetail) }, 304: { description: 'Sin cambios' }, ...errorResponses(400, 401, 404) },
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

const teamCount = async (sb: Db, ids: string[]) => {
  if (!ids.length) return new Map<string, number>();
  const rows = mustHave(await sb.from('tournament_registrations').select('event_id').in('event_id', ids));
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.event_id!, (out.get(r.event_id!) ?? 0) + 1);
  return out;
};

export const events = createRouter()
  .openapi(list, async (c) => {
    const { status, page, per } = c.req.valid('query');
    const { from, to } = pageRange({ page, per });
    let q = c.var.sb.from('events').select(EVENT, { count: 'exact' });
    if (status) q = q.eq('status', status);
    const { data, error, count } = await q.order('starts_on', { ascending: false, nullsFirst: true }).order('name').range(from, to);
    if (error) must({ data, error });
    const rows = (data ?? []) as unknown as EventRow[];
    const [counts, aliases] = await Promise.all([teamCount(c.var.sb, rows.map((r) => r.id)), organizerAliases(c.var.sb, rows.map((r) => r.organizer_id))]);
    return c.json({ items: rows.map((e) => summary(e, counts.get(e.id) ?? 0, aliases)), total: count ?? 0, page, per }, 200);
  })
  .openapi(detail, async (c) => {
    const { id } = c.req.valid('param');
    const sb = c.var.sb;
    const e = must(await sb.from('events').select(EVENT).eq('id', id).maybeSingle()) as unknown as EventRow | null;
    if (!e) throw notFound('ese torneo');
    const [regs, regPlayers, matchRows, groupRows, swissRows, aliases] = await Promise.all([
      sb.from('tournament_registrations').select('team_id, start_stage, created_at, team:teams(id, name, tag)').eq('event_id', id).then(mustHave),
      sb.from('tournament_registration_players').select('team_id, player:players(id, nick)').eq('event_id', id).then(mustHave),
      sb.from('matches').select(MATCH_LIST + ', pos').eq('event_id', id).eq('bye', false).then(mustHave),
      sb.from('event_group_standings').select('*').eq('event_id', id).then(mustHave),
      sb.from('event_swiss_standings').select('*').eq('event_id', id).then(mustHave),
      organizerAliases(sb, [e.organizer_id]),
    ]);
    const teamName = new Map(regs.map((r) => [r.team_id!, r.team]));
    const order = (t: string) => {
      const i = (e.seeds ?? []).indexOf(t);
      return i === -1 ? 1000 : i;
    };
    const registrations = [...regs]
      .sort((a, b) => order(a.team_id!) - order(b.team_id!) || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
      .map((r, i) => ({
        team: r.team!,
        seed: i + 1,
        start_stage: r.start_stage,
        players: regPlayers.filter((p) => p.team_id === r.team_id && p.player).map((p) => ({ player_id: p.player!.id, alias: p.player!.nick })),
      }));

    // Grupos: orden con los desempates de la base.
    const groupIds = [...new Set(groupRows.map((g) => g.grp!))].sort((a, b) => a - b);
    const groups = await Promise.all(
      groupIds.map(async (grp) => {
        const ord = mustHave(await sb.rpc('event_group_order', { p_event: id, p_grp: grp }));
        return {
          grp,
          name: `Grupo ${String.fromCharCode(64 + grp)}`,
          rows: ord.map((o) => {
            const s = groupRows.find((g) => g.grp === grp && g.team_id === o.team_id)!;
            return {
              team: teamName.get(o.team_id) ?? { id: o.team_id, name: '?', tag: null },
              place: o.place, tied: o.tied,
              played: s.played ?? 0, won: s.won ?? 0, lost: s.lost ?? 0, points: s.points ?? 0,
              rounds_for: s.rounds_for ?? 0, rounds_against: s.rounds_against ?? 0, rounds_diff: s.rounds_diff ?? 0,
            };
          }),
        };
      }),
    );
    const phases = [...new Set(swissRows.map((s) => s.phase!))].sort((a, b) => a - b);
    const swiss = phases.map((phase) => ({
      phase,
      rows: swissRows
        .filter((s) => s.phase === phase)
        .sort((a, b) => (b.wins ?? 0) - (a.wins ?? 0) || (a.losses ?? 0) - (b.losses ?? 0) || (b.buchholz ?? 0) - (a.buchholz ?? 0) || (b.rounds_diff ?? 0) - (a.rounds_diff ?? 0) || (a.seed ?? 0) - (b.seed ?? 0))
        .map((s) => ({
          team: teamName.get(s.team_id!) ?? { id: s.team_id!, name: '?', tag: null },
          wins: s.wins ?? 0, losses: s.losses ?? 0, buchholz: s.buchholz ?? 0, rounds_diff: s.rounds_diff ?? 0,
          state: (s.state ?? 'active') as 'active' | 'qualified' | 'eliminated',
        })),
    }));

    const rows = matchRows as unknown as (MatchRow & { pos: number | null })[];
    const rounds = await eventRounds(sb, rows);
    const stageOrder: Record<string, number> = { swiss: 0, group: 0, upper: 1, ko: 1, lower: 2, third: 3, grand: 4 };
    const matchesOut = rows
      .sort((a, b) => (a.phase ?? 1) - (b.phase ?? 1) || (stageOrder[a.stage ?? ''] ?? 9) - (stageOrder[b.stage ?? ''] ?? 9) || (a.grp ?? 0) - (b.grp ?? 0) || (a.round ?? 0) - (b.round ?? 0) || (a.pos ?? 0) - (b.pos ?? 0))
      .map((m) => ({ ...toSummary(m, rounds), stage: m.stage, phase: m.phase, grp: m.grp, round: m.round, pos: m.pos }));

    const user = currentUser(c);
    const viewer = user ? { can_manage: !!must(await sb.rpc('can_manage_event', { p_event: id })) } : null;
    const body = {
      ...summary(e, regs.length, aliases),
      rules: e.rules,
      min_teams: e.min_teams,
      players_min: e.players_min,
      players_max: e.players_max,
      config: (e.config ?? {}) as Record<string, unknown>,
      tie_pending: (e.tie_pending as { grp: number } | null) ?? null,
      registrations,
      groups,
      swiss,
      matches: matchesOut,
      viewer,
    };
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
