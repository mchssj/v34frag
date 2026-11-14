import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { currentUser, isAdmin, isModerator, optionalUser, requireAdmin, requireModerator, requireUser } from '../lib/auth';
import { must, mustHave, notFound, searchTerm } from '../lib/db';
import { notModified } from '../lib/etag';
import { AppError, fromPostgrest } from '../lib/errors';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { BANNER_MAX_BYTES, BANNER_SHAPE } from '../lib/uploads';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  BANNER_HELP,
  BannerResult,
  BannerUpload,
  DrawResult,
  SeedsResult,
  GameMode,
  GameModeBody,
  HistoricTeamBody,
  PendingGameList,
  PendingGameQuery,
  ReviewBody,
  SimilarTeamList,
  SimilarTeamQuery,
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
import { historicTeams, markHistoricSides, MATCH_LIST, toSummary, type MatchRow } from '../services/matches';
import { dropPhoto, removePhoto, savePhoto } from '../services/photos';

type C = Context<AppEnv>;

const LIST =
  'id, name, template, status, starts_on, ends_on, prize, max_teams, organizer_id, organizer_alias, champion_id, champion_name, champion_tag, ' +
  'champion_logo_url, teams, game_mode, players_per_team, subs_max, bo, bo_final, progress_played, progress_total, current_match_id, banner_url, ' +
  'registration_closes_at, finished_at, historic, testing, approval, approval_note, pending_games, admin_review, prize_amount, prize_currency, ' +
  'prize_currency_other';
const EXTRA = 'id, rules, min_teams, config, tie_pending, drawn_at, drawn_by, map_pool';
const done = { 204: { description: 'Hecho' } } as const;

type EventRow = {
  id: string; name: string; template: string; status: string; starts_on: string | null; ends_on: string | null; prize: string | null;
  max_teams: number | null; organizer_id: string | null; organizer_alias: string | null; champion_id: string | null;
  champion_name: string | null; champion_tag: string | null; champion_logo_url: string | null; teams: number; game_mode: string;
  players_per_team: number | null; subs_max: number; bo: number | null; bo_final: number | null; progress_played: number | null;
  progress_total: number | null; current_match_id: string | null; banner_url: string | null; registration_closes_at: string | null;
  finished_at: string | null; historic: boolean; testing: boolean; approval: string; approval_note: string | null; pending_games: number;
  admin_review: boolean; prize_amount: number | string | null; prize_currency: string | null; prize_currency_other: string | null;
};

type BoValue = 1 | 3 | 5;
const bo = (n: number | null): BoValue | null => (n === 1 || n === 3 || n === 5 ? n : null);

const summary = (e: EventRow, stage: string | null = null, hist?: Set<string>): z.infer<typeof EventSummary> => ({
  id: e.id,
  name: e.name,
  template: e.template as z.infer<typeof EventSummary>['template'],
  status: e.status as z.infer<typeof EventSummary>['status'],
  starts_on: e.starts_on,
  ends_on: e.ends_on,
  finished_at: e.finished_at,
  prize: e.prize,
  prize_amount: e.prize_amount === null || e.prize_amount === undefined ? null : Number(e.prize_amount),
  prize_currency: (e.prize_currency ?? null) as z.infer<typeof EventSummary>['prize_currency'],
  prize_currency_other: e.prize_currency_other ?? null,
  teams: e.teams ?? 0,
  max_teams: e.max_teams,
  champion: e.champion_id
    ? { id: e.champion_id, name: e.champion_name ?? '', tag: e.champion_tag, logo_url: e.champion_logo_url, ...(hist?.has(e.champion_id) ? { historic: true } : {}) }
    : null,
  organizer: e.organizer_id ? { user_id: e.organizer_id, alias: e.organizer_alias } : null,
  game_mode: e.game_mode,
  players_per_team: e.players_per_team ?? 5,
  subs_max: e.subs_max ?? 0,
  bo: bo(e.bo),
  bo_final: bo(e.bo_final),
  current_stage: stage,
  progress: e.progress_total === null ? null : { played: e.progress_played ?? 0, total: e.progress_total },
  banner_url: e.banner_url,
  registration_closes_at: e.registration_closes_at,
  historic: !!e.historic,
  testing: !!e.testing,
  approval: (e.approval ?? 'approved') as z.infer<typeof EventSummary>['approval'],
  approval_note: e.approval_note,
  pending_games: e.pending_games ?? 0,
  admin_review: !!e.admin_review,
});

/** Fase de la partida actual de cada torneo en curso (una consulta para toda la página). */
async function currentStages(c: C, rows: EventRow[]): Promise<Map<string, string | null>> {
  const ids = rows.map((e) => e.current_match_id).filter((x): x is string => !!x);
  if (!ids.length) return new Map();
  const ms = mustHave(await c.var.sb.from('match_list').select(MATCH_LIST).in('id', ids)) as unknown as MatchRow[];
  const label = new Map(ms.map((m) => [m.id, toSummary(m).label]));
  return new Map(rows.map((e) => [e.id, e.current_match_id ? (label.get(e.current_match_id) ?? null) : null]));
}

/** La primera partida en vivo del torneo, con el mapa que se está jugando. */
async function liveMatch(c: C, eventId: string): Promise<z.infer<typeof EventDetail>['live_match']> {
  const m = must(
    await c.var.sb
      .from('match_list')
      .select(MATCH_LIST)
      .eq('event_id', eventId)
      .eq('status', 'live')
      .eq('bye', false)
      .order('phase', { ascending: true, nullsFirst: false })
      .order('stage_order', { ascending: true, nullsFirst: false })
      .order('round', { ascending: true, nullsFirst: false })
      .order('grp', { ascending: true, nullsFirst: false })
      .order('pos', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ) as unknown as MatchRow | null;
  if (!m) return null;
  // En una serie, el mapa en juego es el del mix vinculado con !match que está en vivo.
  const game = m.best_of > 1
    ? must(await c.var.sb.from('matches').select('map').eq('parent_match_id', m.id).eq('status', 'live').limit(1).maybeSingle())
    : null;
  return {
    id: m.id,
    label: toSummary(m).label,
    map: game?.map ?? m.map,
    map_index: Math.min((m.score1 ?? 0) + (m.score2 ?? 0) + 1, m.best_of),
    maps_total: m.best_of,
  };
}

// ---------- rutas públicas ----------

const list = createRoute({
  method: 'get', path: '/api/v1/events', tags: ['Torneos'], middleware: [optionalUser] as const,
  summary: 'Torneos',
  description:
    'Por defecto, el que empieza más tarde primero. Sin sesión. Cada torneo trae el modo, los BO, la fase actual y el progreso (sin pedir el detalle). ' +
    'Solo aparecen los que quien consulta puede ver: un torneo en testing lo ven admins y moderadores; uno pendiente o rechazado, además su organizador.',
  request: { query: EventListQuery },
  responses: { 200: { description: 'Torneos', ...json(EventList) }, ...errorResponses(400, 401) },
});

const detail = createRoute({
  method: 'get', path: '/api/v1/events/{id}', tags: ['Torneos'], middleware: [optionalUser] as const,
  summary: 'Torneo',
  description:
    'Configuración, estado, campeón, empate pendiente y la partida en vivo (`live_match`). Inscritos, partidas y tablas van en sus listados. ' +
    'Con `ETag` (`304` si no cambió).',
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
    'El capitán, mientras el torneo está en inscripciones y antes del cierre (o el organizador, también después). `active`: exactamente ' +
    '`players_per_team` del torneo; `subs`: hasta `subs_max`. Tienen que ser del plantel, tener SteamID y no estar inscritos con otro ' +
    'equipo en el mismo torneo. El coach no se inscribe (`400 COACH_NOT_ALLOWED`). Sin SteamID: `400 PLAYER_NOT_LINKED` con los alias en ' +
    '`details.aliases`. Pasado `registration_closes_at`: `409 REGISTRATION_CLOSED`. A cada jugador que entra, cambia de activo a suplente o ' +
    'sale le llega el aviso `event_lineup`.',
  request: { params: EventTeamParam, body: { required: true, ...json(RegistrationBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 409) },
});

const unregister = createRoute({
  method: 'delete', path: '/api/v1/events/{id}/registrations/{teamId}', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Dar de baja un equipo',
  description: 'El capitán (antes del cierre de inscripciones: si no, `409 REGISTRATION_CLOSED`) o el organizador, antes de generar el fixture.',
  request: { params: EventTeamParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 409) },
});

// ---------- organizador o admin ----------

const create = createRoute({
  method: 'post', path: '/api/v1/events', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Crear un torneo',
  description:
    'Un organizador o un admin; un moderador, solo históricos (`historic`). Queda como organizador quien lo crea. Lo de un organizador ' +
    'queda pendiente de aprobación (lo ven él y el staff hasta que un admin o moderador lo apruebe). `testing`, solo admin o moderador.',
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

const draw = createRoute({
  method: 'post', path: '/api/v1/events/{id}/draw', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Sortear la siembra',
  description:
    'Mezcla al azar el orden de los inscritos (el organizador o un admin, antes de generar). Se puede repetir. ' +
    'En las plantillas con grupos, el reparto en serpentina deja sorteados los grupos y el lugar dentro de cada uno. ' +
    'Queda registrado quién y cuándo sorteó (`draw` en el detalle); cambiar la siembra a mano, o una inscripción o baja, borra ese registro.',
  request: { params: EventParam },
  responses: { 200: { description: 'Siembra sorteada', ...json(DrawResult) }, ...errorResponses(400, 401, 403) },
});

const seedRanking = createRoute({
  method: 'post', path: '/api/v1/events/{id}/seeds/ranking', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Sembrar por ranking',
  description:
    'Ordena a los inscritos por los puntos totales del ranking de equipos (torneos y PCW); si empatan, por el ELO promedio de sus activos ' +
    'inscritos; si siguen, por quién se inscribió antes. Reemplaza la siembra (antes de generar). En un suizo de varias etapas, la ' +
    'siembra decide en qué etapa entra cada equipo: los mejores, a la más avanzada (en bloques de `size / 2`). Lo mismo vale al ' +
    'sortear o al cambiar la siembra a mano.',
  request: { params: EventParam },
  responses: { 200: { description: 'Siembra nueva', ...json(SeedsResult) }, ...errorResponses(400, 401, 403, 404) },
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

const bannerLimit = bodyLimit({
  maxSize: BANNER_MAX_BYTES + 16 * 1024,
  onError: () => {
    throw new AppError(413, 'FILE_TOO_LARGE', `La imagen pesa más de ${BANNER_MAX_BYTES / 1024} KB.`);
  },
});

const putBanner = createRoute({
  method: 'put', path: '/api/v1/events/{id}/banner', tags: ['Torneos'], security: bearer, middleware: [requireUser, bannerLimit] as const,
  summary: 'Subir el banner', description: `\`multipart/form-data\`, campo \`file\`. El organizador del torneo o un admin. Reemplaza al anterior. ${BANNER_HELP}`,
  request: { params: EventParam, body: { required: true, content: { 'multipart/form-data': { schema: BannerUpload } } } },
  responses: { 200: { description: 'Banner guardado', ...json(BannerResult) }, ...errorResponses(400, 401, 403, 404, 413) },
});

const deleteBanner = createRoute({
  method: 'delete', path: '/api/v1/events/{id}/banner', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Quitar el banner', description: 'El organizador del torneo o un admin. Vuelve el patrón por defecto.',
  request: { params: EventParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});

const gameModes = createRoute({
  method: 'get', path: '/api/v1/game-modes', tags: ['Torneos'], middleware: [optionalUser] as const,
  summary: 'Modos de juego', description: 'Los habilitados para crear torneos, del más chico al más grande. Sin sesión.',
  responses: { 200: { description: 'Modos', ...json(z.array(GameMode)) }, ...errorResponses(401) },
});

const adminGameModes = createRoute({
  method: 'get', path: '/api/v1/admin/game-modes', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Modos de juego (todos)', description: 'Habilitados y deshabilitados.',
  responses: { 200: { description: 'Modos', ...json(z.array(GameMode)) }, ...errorResponses(401, 403) },
});

const putGameMode = createRoute({
  method: 'put', path: '/api/v1/admin/game-modes', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Habilitar o deshabilitar un modo',
  description: 'Un torneo que ya usa el modo lo conserva; los nuevos no lo pueden elegir. Tiene que quedar al menos uno habilitado.',
  request: { body: { required: true, ...json(GameModeBody) } },
  responses: { 200: { description: 'Modos', ...json(z.array(GameMode)) }, ...errorResponses(400, 401, 403) },
});


// ---------- aprobación (admin o moderador) y torneos históricos ----------

const review = createRoute({
  method: 'post', path: '/api/v1/events/{id}/review', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Aprobar o rechazar un torneo pendiente',
  description:
    'Admin o moderador. Aprobado, se ve para todos (y si tiene las inscripciones abiertas, se anuncia); también quedan aprobados los ' +
    'mixes que vinculó el organizador. Rechazado, con `note` obligatoria: lo ve el organizador, que lo corrige y lo vuelve a enviar. ' +
    'Al organizador le llega el aviso `event_reviewed`. `409` si el torneo no espera aprobación.',
  request: { params: EventParam, body: { required: true, ...json(ReviewBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 404, 409) },
});

const resubmit = createRoute({
  method: 'post', path: '/api/v1/events/{id}/resubmit', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Volver a enviar un torneo rechazado',
  description: 'El organizador del torneo. Vuelve a pendiente y les llega el aviso `admin_event_review` a admins y moderadores.',
  request: { params: EventParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 404, 409) },
});

const historicTeam = createRoute({
  method: 'post', path: '/api/v1/events/{id}/historic-teams', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Cargar un equipo que no está en la plataforma',
  description:
    'Solo en un torneo histórico, antes de generar el fixture; quien gestiona el torneo. Crea un equipo histórico (sin capitán, plantel ' +
    'ni página; no aparece en Buscar equipo ni en el ranking) y lo inscribe. Los jugadores, opcionales, con PUT /registrations/{teamId}. ' +
    'El logo, con PUT /teams/{id}/logo. Antes conviene mirar GET /events/{id}/similar-teams por si ya existe.',
  request: { params: EventParam, body: { required: true, ...json(HistoricTeamBody) } },
  responses: { 201: { description: 'Creado e inscrito', ...json(Created) }, ...errorResponses(400, 401, 403, 404) },
});

const similarTeams = createRoute({
  method: 'get', path: '/api/v1/events/{id}/similar-teams', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Equipos con un nombre parecido',
  description: 'Quien gestiona el torneo. Equipos de la plataforma e históricos ya cargados con un nombre o sigla parecidos (hasta 10), para no duplicar uno.',
  request: { params: EventParam, query: SimilarTeamQuery },
  responses: { 200: { description: 'Equipos', ...json(SimilarTeamList) }, ...errorResponses(400, 401, 403) },
});

const patchHistoricTeam = createRoute({
  method: 'patch', path: '/api/v1/historic-teams/{id}', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Corregir un equipo histórico',
  description: 'Nombre y sigla. Admin, moderador o quien gestiona un torneo histórico donde está inscrito.',
  request: { params: EventParam, body: { required: true, ...json(HistoricTeamBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

const pendingGames = createRoute({
  method: 'get', path: '/api/v1/admin/pending-games', tags: ['Admin'], security: bearer, middleware: [requireUser, requireModerator] as const,
  summary: 'Mixes vinculados por aprobar',
  description:
    'Admin o moderador. Los mixes que vinculó un organizador a una partida de torneo y esperan aprobación, con la partida. Se aprueban ' +
    'o se rechazan con POST /matches/{id}/games/{gameId}/review. Los torneos pendientes salen en GET /events?approval=pending.',
  request: { query: PendingGameQuery },
  responses: { 200: { description: 'Mixes por aprobar', ...json(PendingGameList) }, ...errorResponses(400, 401, 403) },
});

const GAME_MODE = 'code, name, players_per_team, active';

export const events = createRouter()
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('event_list').select(LIST, { count: 'exact' });
    if (p.status) q = q.eq('status', p.status);
    if (p.template) q = q.eq('template', p.template);
    if (p.organizer) q = q.eq('organizer_id', p.organizer);
    if (p.game_mode) q = q.eq('game_mode', p.game_mode);
    if (p.from) q = q.gte('starts_on', p.from.slice(0, 10));
    if (p.to) q = q.lte('starts_on', p.to.slice(0, 10));
    if (p.historic !== undefined) q = q.eq('historic', p.historic);
    if (p.testing !== undefined) q = q.eq('testing', p.testing);
    if (p.approval) q = q.eq('approval', p.approval);
    if (p.pending_games !== undefined) q = p.pending_games ? q.gt('pending_games', 0) : q.eq('pending_games', 0);
    if (p.admin_review !== undefined) q = q.eq('admin_review', p.admin_review);
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    const { rows, total } = await runList<EventRow, typeof q>(q, p, {});
    const [stages, hist] = await Promise.all([currentStages(c, rows), historicTeams(c.var.sb, rows.map((e) => e.champion_id))]);
    return c.json(envelope(rows.map((e) => summary(e, stages.get(e.id) ?? null, hist)), total, p), 200);
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
    const viewer = user
      ? await Promise.all([
          sb.rpc('can_manage_event', { p_event: id }).then(must),
          sb.rpc('can_own_event', { p_event: id }).then(must),
          isModerator(c),
          isAdmin(c),
        ]).then(([manage, own, staff, adm]) => ({
          can_manage: !!manage,
          can_own: !!own,
          can_review: staff,
          // (replanteo 84) lo de un moderador lo aprueba solo un admin
          can_approve: adm || (staff && !(e as unknown as EventRow).admin_review),
        }))
      : null;
    const row = e as unknown as EventRow;
    const [stages, live, hist] = await Promise.all([currentStages(c, [row]), liveMatch(c, id), historicTeams(sb, [row.champion_id])]);
    const body = {
      ...summary(row, stages.get(id) ?? null, hist),
      rules: extra.rules,
      min_teams: extra.min_teams,
      live_match: live,
      config: (extra.config ?? {}) as Record<string, unknown>,
      tie_pending: (extra.tie_pending as { grp: number } | null) ?? null,
      map_pool: extra.map_pool,
      draw: extra.drawn_at
        ? {
            at: extra.drawn_at,
            by: {
              user_id: extra.drawn_by,
              alias: extra.drawn_by ? (must(await sb.from('players').select('nick').eq('user_id', extra.drawn_by).maybeSingle())?.nick ?? null) : null,
            },
          }
        : null,
      viewer,
    };
    if (await notModified(c, body)) return c.body(null, 304);
    return c.json(body, 200);
  })
  .openapi(registrations, async (c) => {
    const { id } = c.req.valid('param');
    const p = c.req.valid('query');
    let q = c.var.sb.from('event_registrations_view').select('team_id, name, tag, logo_url, seed, start_stage', { count: 'exact' }).eq('event_id', id);
    if (p.start_stage) q = q.eq('start_stage', p.start_stage);
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    type Row = { team_id: string; name: string; tag: string | null; logo_url: string | null; seed: number; start_stage: number };
    const { rows, total } = await runList<Row, typeof q>(q, p, {}, 'team_id');
    const players = rows.length
      ? mustHave(
          await c.var.sb
            .from('tournament_registration_players')
            .select('team_id, role, player:players(id, nick)')
            .eq('event_id', id)
            .in('team_id', rows.map((r) => r.team_id)),
        )
      : [];
    const [hist, guests] = await Promise.all([
      historicTeams(c.var.sb, rows.map((r) => r.team_id)),
      rows.length
        ? c.var.sb.from('tournament_registrations').select('team_id, guest_names').eq('event_id', id).in('team_id', rows.map((r) => r.team_id)).then(mustHave)
        : Promise.resolve([]),
    ]);
    const guestsOf = new Map(guests.map((g) => [g.team_id, g.guest_names ?? []]));
    const items = rows.map((r) => ({
      team: { id: r.team_id, name: r.name, tag: r.tag, logo_url: r.logo_url, ...(hist.has(r.team_id) ? { historic: true } : {}) },
      seed: r.seed,
      start_stage: r.start_stage,
      players: players
        .filter((x) => x.team_id === r.team_id && x.player)
        .map((x) => ({ player_id: x.player!.id, alias: x.player!.nick, role: x.role === 'sub' ? ('sub' as const) : ('active' as const) }))
        .sort((a, b) => (a.role === b.role ? a.alias.localeCompare(b.alias) : a.role === 'active' ? -1 : 1)),
      guests: guestsOf.get(r.team_id) ?? [],
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
    // A qué partida pasa cada lado (no está en match_list).
    const links = rows.length
      ? new Map(
          mustHave(await c.var.sb.from('matches').select('id, next_win, next_win_slot, next_lose, next_lose_slot').in('id', rows.map((m) => m.id))).map((l) => [l.id, l]),
        )
      : new Map();
    const items = await markHistoricSides(
      c.var.sb,
      rows.map((m) => {
        const l = links.get(m.id);
        return {
          ...toSummary(m), stage: m.stage, phase: m.phase, grp: m.grp, round: m.round, pos: m.pos, bye: m.bye,
          next_win: l?.next_win ?? null, next_win_slot: l?.next_win_slot ?? null, next_lose: l?.next_lose ?? null, next_lose_slot: l?.next_lose_slot ?? null,
        };
      }),
    );
    const body = envelope(items, total, p);
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
        stage: r.stage as 'group' | 'swiss' | 'group_double', grp: r.grp, phase: r.phase, team: { id: r.team_id, name: r.name, tag: r.tag },
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
    const { active, subs, start_stage, guests } = c.req.valid('json');
    // Con nombres (histórico, replanteo 113): fichas y nombres juntos en una sola llamada.
    if (guests !== undefined) {
      if (subs.length) throw new AppError(400, 'BUSINESS_RULE', 'En un torneo histórico no hay suplentes.');
      must(await c.var.sb.rpc('event_register_historic', { p_event: id, p_team: teamId, p_players: active, p_names: guests, p_start_stage: start_stage }));
    } else {
      must(await c.var.sb.rpc('event_register', { p_event: id, p_team: teamId, p_active: active, p_subs: subs, p_start_stage: start_stage }));
    }
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
    if (r.error?.code === '42501') {
      throw new AppError(403, 'FORBIDDEN', r.error.message.includes('testing') ? r.error.message : 'Solo un organizador o un admin crea torneos (un moderador, solo históricos).');
    }
    return c.json({ id: mustHave(r).id }, 201);
  })
  .openapi(patch, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const rows = mustHave(await c.var.sb.from('events').update({ ...body, config: body.config as never }).eq('id', id).select('id'));
    if (!rows.length) throw new AppError(403, 'FORBIDDEN', 'Solo el organizador del torneo o un admin puede editarlo.');
    return c.body(null, 204);
  })
  .openapi(review, async (c) => {
    const { approve, note } = c.req.valid('json');
    must(await c.var.sb.rpc('event_review', { p_event: c.req.valid('param').id, p_approve: approve, p_note: note ?? undefined }));
    return c.body(null, 204);
  })
  .openapi(resubmit, async (c) => {
    must(await c.var.sb.rpc('event_resubmit', { p_event: c.req.valid('param').id }));
    return c.body(null, 204);
  })
  .openapi(historicTeam, async (c) => {
    const { name, tag } = c.req.valid('json');
    const id = mustHave(await c.var.sb.rpc('event_create_historic_team', { p_event: c.req.valid('param').id, p_name: name, p_tag: tag })) as string;
    return c.json({ id }, 201);
  })
  .openapi(similarTeams, async (c) => {
    const { id } = c.req.valid('param');
    const p = c.req.valid('query');
    if (!must(await c.var.sb.rpc('can_manage_event', { p_event: id }))) throw new AppError(403, 'FORBIDDEN', 'Solo quien gestiona el torneo.');
    type Row = { team_id: string; name: string; tag: string | null; kind: string; logo_url: string | null };
    const rows = mustHave(await c.var.sb.rpc('historic_team_similar', { p_name: p.q })) as Row[];
    const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name) * (p.order === 'desc' ? -1 : 1));
    const items = sorted.slice((p.page - 1) * p.per, p.page * p.per).map((r) => ({
      id: r.team_id, name: r.name, tag: r.tag, logo_url: r.logo_url, kind: r.kind === 'historic' ? ('historic' as const) : ('official' as const),
    }));
    return c.json(envelope(items, rows.length, p), 200);
  })
  .openapi(patchHistoricTeam, async (c) => {
    const { name, tag } = c.req.valid('json');
    must(await c.var.sb.rpc('historic_team_update', { p_team: c.req.valid('param').id, p_name: name, p_tag: tag }));
    return c.body(null, 204);
  })
  .openapi(pendingGames, async (c) => {
    const p = c.req.valid('query');
    const sb = c.var.sb;
    let q = sb
      .from('matches')
      .select('id, map, score1, score2, played_at, parent_match_id, parent_side1', { count: 'exact' })
      .eq('parent_approved', false);
    if (p.match) q = q.eq('parent_match_id', p.match);
    type Row = { id: string; map: string | null; score1: number | null; score2: number | null; played_at: string | null; parent_match_id: string; parent_side1: number | null };
    const { rows, total } = await runList<Row, typeof q>(q, p, {});
    const parents = rows.length
      ? (mustHave(await sb.from('match_list').select(MATCH_LIST).in('id', [...new Set(rows.map((r) => r.parent_match_id))])) as unknown as MatchRow[])
      : [];
    const byId = new Map((await markHistoricSides(sb, parents.map(toSummary))).map((m) => [m.id, m]));
    const items = rows
      .filter((r) => byId.has(r.parent_match_id))
      .map((r) => {
        const flip = r.parent_side1 === 2;
        return {
          game: { id: r.id, map: r.map, score1: flip ? r.score2 : r.score1, score2: flip ? r.score1 : r.score2, played_at: r.played_at },
          match: byId.get(r.parent_match_id)!,
        };
      });
    return c.json(envelope(items, total, p), 200);
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
  .openapi(seedRanking, async (c) => {
    const { id } = c.req.valid('param');
    const ids = mustHave(await c.var.sb.rpc('event_seed_ranking', { p_event: id })) as string[];
    const teams = mustHave(await c.var.sb.from('teams').select('id, name, tag').in('id', ids));
    const byId = new Map(teams.map((t) => [t.id, t]));
    return c.json({ seeds: ids.map((t) => ({ id: t, name: byId.get(t)?.name ?? '', tag: byId.get(t)?.tag ?? null })) }, 200);
  })
  .openapi(draw, async (c) => {
    const { id } = c.req.valid('param');
    const ids = mustHave(await c.var.sb.rpc('event_draw', { p_event: id })) as string[];
    const [teams, ev] = await Promise.all([
      c.var.sb.from('teams').select('id, name, tag').in('id', ids).then(mustHave),
      c.var.sb.from('events').select('drawn_at').eq('id', id).single().then(mustHave),
    ]);
    const byId = new Map(teams.map((t) => [t.id, t]));
    return c.json(
      { seeds: ids.map((t) => ({ id: t, name: byId.get(t)?.name ?? '', tag: byId.get(t)?.tag ?? null })), drawn_at: ev.drawn_at as string },
      200,
    );
  })
  .openapi(generate, async (c) => {
    must(await c.var.sb.rpc('event_generate', { p_event: c.req.valid('param').id }));
    return c.body(null, 204);
  })
  .openapi(reset, async (c) => {
    must(await c.var.sb.rpc('event_reset', { p_event: c.req.valid('param').id }));
    return c.body(null, 204);
  })
  .openapi(putBanner, async (c) => {
    const { id } = c.req.valid('param');
    const sb = c.var.sb;
    const ev = must(await sb.from('events').select('banner_url').eq('id', id).maybeSingle());
    if (!ev) throw notFound('ese torneo');
    if (!must(await sb.rpc('can_manage_event', { p_event: id }))) {
      throw new AppError(403, 'FORBIDDEN', 'Solo el organizador del torneo o un admin cambia el banner.');
    }
    const { url, path } = await savePhoto(c, `events/${id}`, c.req.valid('form').file, BANNER_MAX_BYTES, BANNER_SHAPE);
    const saved = await sb.from('events').update({ banner_url: url }).eq('id', id).select('id');
    if (saved.error || !saved.data.length) {
      await dropPhoto(c, path);
      throw saved.error ? fromPostgrest(saved.error) : new AppError(403, 'FORBIDDEN', 'Solo el organizador del torneo o un admin cambia el banner.');
    }
    removePhoto(c, ev.banner_url);
    return c.json({ banner_url: url }, 200);
  })
  .openapi(deleteBanner, async (c) => {
    const { id } = c.req.valid('param');
    const ev = must(await c.var.sb.from('events').select('banner_url').eq('id', id).maybeSingle());
    if (!ev) throw notFound('ese torneo');
    const rows = mustHave(await c.var.sb.from('events').update({ banner_url: null }).eq('id', id).select('id'));
    if (!rows.length) throw new AppError(403, 'FORBIDDEN', 'Solo el organizador del torneo o un admin cambia el banner.');
    removePhoto(c, ev.banner_url);
    return c.body(null, 204);
  })
  .openapi(gameModes, async (c) => {
    return c.json(mustHave(await c.var.sb.from('game_modes').select(GAME_MODE).eq('active', true).order('sort')), 200);
  })
  .openapi(adminGameModes, async (c) => {
    return c.json(mustHave(await c.var.sb.from('game_modes').select(GAME_MODE).order('sort')), 200);
  })
  .openapi(putGameMode, async (c) => {
    const { code, active } = c.req.valid('json');
    must(await c.var.sb.rpc('set_game_mode_active', { p_code: code, p_active: active }));
    return c.json(mustHave(await c.var.sb.from('game_modes').select(GAME_MODE).order('sort')), 200);
  })
  .openapi(ties, async (c) => {
    const { grp, order } = c.req.valid('json');
    must(await c.var.sb.rpc('event_resolve_tie', { p_event: c.req.valid('param').id, p_grp: grp, p_order: order }));
    return c.body(null, 204);
  });
