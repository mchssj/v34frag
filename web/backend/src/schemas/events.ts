import { z } from '@hono/zod-openapi';
import { MapPoolNames } from './pcw';
import { boolParam, dateParam, Envelope, listQuery } from '../lib/list';
import { MatchStatus, MatchSummary } from './matches';
import { TeamRef } from './players';

export const Template = z.enum(['single', 'double', 'groups', 'swiss', 'groups_double']).openapi({
  description:
    '`single` eliminación directa, `double` doble eliminación, `groups` grupos + playoffs, `swiss` suizo + playoffs, ' +
    '`groups_double` grupos de doble eliminación + playoffs',
});
export const EventStatus = z.enum(['registration', 'in_progress', 'finished', 'cancelled']);
export const PrizeCurrency = z.enum(['USD', 'ARS', 'other']).openapi({
  description: 'Divisa del premio: `USD`, `ARS` (pesos argentinos) u `other` (con `prize_currency_other`, por ejemplo `BRL`)',
});
export const EventApproval = z.enum(['pending', 'approved', 'rejected']).openapi({
  description: '`pending`: lo creó un organizador y espera a un admin o moderador; `approved`; `rejected` (con `approval_note`). Solo lo aprobado se ve para todos',
});

const Bo = z.union([z.literal(1), z.literal(3), z.literal(5)]);
const Playoffs = z
  .object({ bo: Bo, bo_semi: Bo, bo_final: Bo, third_place: z.boolean(), bo_third: Bo })
  .partial()
  .openapi('PlayoffsConfig');

export const EventConfig = z
  .object({
    // single y los playoffs de groups/swiss
    bo: Bo, bo_semi: Bo, bo_final: Bo, third_place: z.boolean(), bo_third: Bo,
    // double
    bo_upper_final: Bo, bo_lower_final: Bo, bo_grand_final: Bo, advantage: z.boolean(),
    // groups (y groups_double: groups de 1 a 8, advance 2 o 3, bo_group)
    groups: z.number().int().min(1).max(16), advance: z.number().int().min(1).max(8), double_rr: z.boolean(), bo_group: Bo,
    // swiss
    stages: z.number().int().min(1).max(3), size: z.union([z.literal(8), z.literal(16)]), wins: z.union([z.literal(2), z.literal(3)]), bo_decisive: Bo,
    playoffs: Playoffs,
    decider_versions: z.record(z.string(), z.string()).openapi({ description: 'Versión del mapa decisivo, por ejemplo { "de_inferno": "de_inferno_classic" }' }),
  })
  .partial()
  .openapi('EventConfig', {
    description:
      'Solo las claves de la plantilla elegida; las que faltan toman el valor por defecto. Por defecto: single todo BO3; ' +
      'double BO3 y gran final BO5, sin mapa de ventaja; groups 2 grupos, clasifican 2, grupos BO1 y playoffs BO3; ' +
      'swiss 1 fase de 16, 3 victorias, BO1 y decisivas BO3, playoffs BO3; groups_double 2 grupos, clasifican 3, grupos BO3, ' +
      'playoffs BO3 y final BO5. 3.er puesto apagado.',
  });

export const EventListQuery = listQuery(['starts_on', 'name', 'status'], { sort: 'starts_on', order: 'desc' }).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en el nombre' }),
  status: EventStatus.optional(),
  template: Template.optional(),
  organizer: z.uuid().optional().openapi({ description: 'Torneos de un organizador (id de usuario)' }),
  game_mode: z.string().max(5).optional().openapi({ description: 'Modo de juego (`5v5`, `2v2`…)' }),
  from: dateParam('Empiezan desde esta fecha'),
  to: dateParam('Empiezan hasta esta fecha'),
  historic: boolParam('Solo los históricos (`true`) o solo los normales (`false`)'),
  testing: boolParam('Solo los que están en fase de testing (`true`) o los que no (`false`). Los en testing los ven solo admins y moderadores'),
  approval: EventApproval.optional(),
  pending_games: boolParam('Solo los que tienen mixes vinculados por aprobar'),
  admin_review: boolParam('Solo los que aprueba un admin (`true`: los creó un moderador) o los que aprueba el staff (`false`)'),
});

export const EventSummary = z
  .object({
    id: z.uuid(),
    name: z.string(),
    template: Template,
    status: EventStatus,
    starts_on: z.string().nullable(),
    ends_on: z.string().nullable().openapi({ description: 'Fin tentativo que pone el organizador: el torneo puede terminar antes o después' }),
    finished_at: z.string().nullable().openapi({ description: 'Cuándo terminó de verdad: la última partida jugada. null mientras no terminó (o si sus partidas no tienen fecha)' }),
    prize: z.string().nullable().openapi({ description: 'Detalle del premio en texto libre (por ejemplo "+ rol en Discord")' }),
    prize_amount: z.number().nullable().openapi({ description: 'Monto del premio (con `prize_currency`); null: sin monto' }),
    prize_currency: PrizeCurrency.nullable(),
    prize_currency_other: z.string().nullable().openapi({ description: 'Nombre de la divisa si `prize_currency` es `other`' }),
    teams: z.number().int().openapi({ description: 'Equipos inscritos' }),
    max_teams: z.number().int().nullable(),
    champion: TeamRef.nullable(),
    organizer: z.object({ user_id: z.uuid(), alias: z.string().nullable() }).nullable(),
    game_mode: z.string().openapi({ description: 'Modo de juego (`5v5`, `2v2`…; ver GET /game-modes)' }),
    players_per_team: z.number().int().openapi({ description: 'Activos que inscribe cada equipo (los del modo)' }),
    subs_max: z.number().int().openapi({ description: 'Suplentes que puede inscribir cada equipo (0 a 4)' }),
    bo: Bo.nullable().openapi({ description: 'BO de las partidas comunes (`bo` o `bo_group` según la plantilla)' }),
    bo_final: Bo.nullable().openapi({ description: 'BO de la final (`bo_final`, `bo_grand_final` o `playoffs.bo_final`)' }),
    current_stage: z.string().nullable().openapi({ description: 'Fase de la partida en vivo o de la próxima ("Semifinal"). null si el torneo no está en curso' }),
    progress: z
      .object({ played: z.number().int(), total: z.number().int() })
      .nullable()
      .openapi({ description: 'Partidas terminadas y armadas hasta ahora (sin libres). null antes de generar el fixture. `total` crece a medida que se arman las rondas siguientes' }),
    banner_url: z.string().nullable().openapi({ description: 'Banner; null: patrón por defecto' }),
    registration_closes_at: z.string().nullable().openapi({ description: 'Cierre de inscripciones. null: hasta que se genera el fixture' }),
    historic: z.boolean().openapi({ description: 'Torneo histórico: el registro de un torneo ya jugado (sin inscripciones de los capitanes ni avisos)' }),
    testing: z.boolean().openapi({ description: 'En fase de testing: solo lo ven y lo gestionan admins y moderadores' }),
    approval: EventApproval,
    approval_note: z.string().nullable().openapi({ description: 'Motivo del rechazo (lo ven el organizador y el staff)' }),
    pending_games: z.number().int().openapi({ description: 'Mixes vinculados que esperan aprobación' }),
    admin_review: z.boolean().openapi({ description: 'Lo creó un moderador: lo aprueba o lo rechaza solo un admin' }),
  })
  .openapi('EventSummary');

export const EventList = Envelope(EventSummary).openapi('EventList');

export const Registration = z
  .object({
    team: TeamRef,
    seed: z.number().int().openapi({ description: 'Posición en la siembra (1 = cabeza de serie)' }),
    start_stage: z.number().int().openapi({ description: 'Suizo: fase en la que empieza' }),
    players: z
      .array(z.object({ player_id: z.uuid(), alias: z.string(), role: z.enum(['active', 'sub']).openapi({ description: '`active` o `sub` (suplente)' }) }))
      .openapi({ description: 'Primero los activos y después los suplentes, cada grupo por alias' }),
    guests: z
      .array(z.string())
      .openapi({ description: 'Torneo histórico: jugadores sin ficha, solo el nombre, en el orden en que se cargaron. Vacío en los demás (replanteo 113)' }),
  })
  .openapi('Registration');

export const RegistrationQuery = listQuery(['seed', 'name'], { sort: 'seed', order: 'asc' }).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en el nombre y la sigla del equipo' }),
  start_stage: z.coerce.number().int().min(1).max(3).optional(),
});
export const RegistrationList = Envelope(Registration).openapi('RegistrationList');

export const EventMatch = MatchSummary.extend({
  stage: z.string().nullable().openapi({ description: '`ko`, `third`, `upper`, `lower`, `grand`, `group`, `swiss`, `group_upper` o `group_lower` (grupos de doble eliminación)' }),
  phase: z.number().int().nullable(),
  grp: z.number().int().nullable(),
  round: z.number().int().nullable(),
  pos: z.number().int().nullable(),
  bye: z.boolean(),
  next_win: z.uuid().nullable().openapi({ description: 'Partida a la que pasa el ganador (null si no sigue en la llave)' }),
  next_win_slot: z.number().int().nullable().openapi({ description: 'Lado (1 o 2) que ocupa el ganador en `next_win`' }),
  next_lose: z.uuid().nullable().openapi({ description: 'Partida a la que pasa el perdedor (lower o 3.er puesto); null si queda eliminado' }),
  next_lose_slot: z.number().int().nullable().openapi({ description: 'Lado (1 o 2) que ocupa el perdedor en `next_lose`' }),
}).openapi('EventMatch');

export const EventMatchQuery = listQuery(['bracket', 'starts_at', 'played_at'], { sort: 'bracket', order: 'asc' }, 200).extend({
  stage: z.enum(['ko', 'third', 'upper', 'lower', 'grand', 'group', 'swiss', 'group_upper', 'group_lower']).optional(),
  phase: z.coerce.number().int().optional(),
  grp: z.coerce.number().int().optional(),
  round: z.coerce.number().int().optional(),
  status: MatchStatus.optional(),
  team: z.uuid().optional(),
  include_byes: boolParam('Incluir los byes (para dibujar la llave completa)'),
});
export const EventMatchList = Envelope(EventMatch).openapi('EventMatchList');

export const Standing = z
  .object({
    stage: z.enum(['group', 'swiss', 'group_double']).openapi({ description: '`group_double`: grupo de doble eliminación (`groups_double`)' }),
    grp: z.number().int().openapi({ description: 'Grupo (1 = A); 1 en el suizo' }),
    phase: z.number().int().openapi({ description: 'Fase suiza; 1 en grupos' }),
    team: TeamRef,
    place: z.number().int().openapi({ description: 'En group_double: 1.º gana la final del upper, 2.º la final del lower, 3.º la pierde; los eliminados en la misma ronda comparten puesto' }),
    tied: z.boolean().openapi({ description: 'Grupos: empatado en todos los criterios con el de al lado' }),
    played: z.number().int(),
    won: z.number().int(),
    lost: z.number().int(),
    points: z.number().int().nullable().openapi({ description: 'Grupos: 3 por victoria' }),
    rounds_for: z.number().int().nullable(),
    rounds_against: z.number().int().nullable(),
    rounds_diff: z.number().int(),
    buchholz: z.number().int().nullable().openapi({ description: 'Suizo' }),
    state: z.enum(['active', 'qualified', 'eliminated']).nullable().openapi({ description: 'Suizo y group_double (`active`: sigue en carrera)' }),
  })
  .openapi('Standing');

export const StandingQuery = listQuery(['place'], { sort: 'place', order: 'asc' }, 200).extend({
  stage: z.enum(['group', 'swiss', 'group_double']).optional(),
  grp: z.coerce.number().int().optional(),
  phase: z.coerce.number().int().optional(),
});
export const StandingList = Envelope(Standing).openapi('StandingList');

export const LiveMatch = z
  .object({
    id: z.uuid(),
    label: z.string().nullable().openapi({ description: 'Fase ("Semifinal")' }),
    map: z.string().nullable().openapi({ description: 'Mapa que se está jugando (null si todavía no se sabe)' }),
    map_index: z.number().int().openapi({ description: 'Número del mapa en la serie (los ya jugados + 1)' }),
    maps_total: z.number().int().openapi({ description: 'BO de la serie' }),
  })
  .openapi('LiveMatch');

export const EventDetail = EventSummary.extend({
  rules: z.string().nullable(),
  min_teams: z.number().int().nullable(),
  live_match: LiveMatch.nullable().openapi({ description: 'La primera partida en vivo del torneo; null si no hay ninguna' }),
  config: z.record(z.string(), z.unknown()).openapi({ description: 'Configuración completa (con los valores por defecto)' }),
  tie_pending: z.object({ grp: z.number().int() }).nullable().openapi({ description: 'Empate de grupo que tiene que resolver el organizador' }),
  draw: z
    .object({ at: z.string(), by: z.object({ user_id: z.uuid().nullable(), alias: z.string().nullable() }) })
    .nullable()
    .openapi({ description: 'Sorteo de la siembra (POST /events/{id}/draw): cuándo y quién. null si la siembra se cargó a mano o cambió después' }),
  map_pool: z.array(z.string()).nullable().openapi({ description: 'Pool del veto del torneo; `null`: el pool por defecto (GET /maps?veto_default=true)' }),
  viewer: z
    .object({
      can_manage: z.boolean().openapi({ description: 'Gestiona el torneo: admin, moderador u organizador dueño' }),
      can_own: z.boolean().openapi({ description: 'Además lo cancela y lo borra: admin, u organizador o moderador que lo creó' }),
      can_review: z.boolean().openapi({ description: 'Es del staff: aprueba los mixes vinculados y cambia la fase de testing (admin o moderador)' }),
      can_approve: z.boolean().openapi({ description: 'Aprueba o rechaza este torneo: admin; moderador si no lo creó un moderador (`admin_review`)' }),
    })
    .nullable(),
}).openapi('EventDetail', {
  description: 'Inscritos, partidas y tablas van en sus propios listados: /events/{id}/registrations, /matches y /standings',
});

export const EventCreate = z
  .object({
    name: z.string().trim().min(2).max(80),
    template: Template,
    config: EventConfig.optional(),
    game_mode: z.string().max(5).optional().openapi({ description: 'Modo de juego habilitado (GET /game-modes). Por defecto `5v5`' }),
    subs_max: z.number().int().min(0).max(4).optional().openapi({ description: 'Suplentes por equipo, de 0 a 4 (por defecto 0)' }),
    registration_closes_at: z.iso
      .datetime({ offset: true })
      .nullable()
      .optional()
      .openapi({ description: 'Cierre de inscripciones (fecha y hora). Después, solo el organizador o un admin cambian las inscripciones. null: hasta generar el fixture' }),
    starts_on: z.iso.date().nullable().optional(),
    ends_on: z.iso.date().nullable().optional().openapi({ description: 'Fin tentativo (opcional): puede terminar antes o después. La API no lo valida (el formulario avisa si es anterior a `starts_on`); el fin real es `finished_at`' }),
    prize: z.string().trim().max(200).nullable().optional().openapi({ description: 'Detalle del premio en texto libre' }),
    prize_amount: z.number().positive().max(9999999999.99).multipleOf(0.01).nullable().optional()
      .openapi({ description: 'Monto del premio (pide `prize_currency`). null: sin monto' }),
    prize_currency: PrizeCurrency.nullable().optional().openapi({ description: 'Divisa del monto (pide `prize_amount`)' }),
    prize_currency_other: z.string().trim().min(1).max(12).nullable().optional()
      .openapi({ description: 'Nombre de la divisa, solo con `prize_currency` = `other`' }),
    rules: z.string().trim().max(5000).nullable().optional(),
    min_teams: z.number().int().min(2).max(256).nullable().optional(),
    max_teams: z.number().int().min(2).max(256).nullable().optional(),
    map_pool: MapPoolNames.optional().openapi({ description: 'Pool del veto del torneo, entre los mapas disponibles del catálogo (al menos el BO más alto de `config`). `null`: el pool por defecto. No cambia después del primer veto' }),
    historic: z.boolean().optional().openapi({ description: 'Torneo histórico (pide `starts_on` y `ends_on`). Lo crean admins, moderadores y organizadores. No se cambia después' }),
    testing: z.boolean().optional().openapi({ description: 'En fase de testing (solo admin o moderador; por defecto `false`)' }),
  })
  .openapi('EventCreate', {
    description:
      'Lo que crea un organizador o un moderador queda pendiente de aprobación (`approval`); lo de un admin, aprobado. Lo de un moderador lo ' +
      'aprueba solo un admin (`admin_review`). El premio: `prize_amount` y `prize_currency` van juntos, y `prize_currency_other` solo con `other`',
  });

export const EventPatch = EventCreate.omit({ historic: true })
  .partial()
  .refine((o) => Object.values(o).some((v) => v !== undefined), { message: 'No hay nada para actualizar.' })
  .openapi('EventPatch');

export const RegistrationBody = z
  .object({
    active: z.array(z.uuid()).max(10).openapi({ description: 'Activos: exactamente `players_per_team` del torneo, miembros del plantel con SteamID. En un histórico, de 0 a 10 fichas cualesquiera (sin plantel ni SteamID)' }),
    subs: z.array(z.uuid()).max(4).default([]).openapi({ description: 'Suplentes: hasta `subs_max` del torneo. El coach no se inscribe' }),
    start_stage: z.number().int().min(1).max(3).optional().openapi({ description: 'Suizo: fase en la que empieza (solo el organizador)' }),
    guests: z
      .array(z.string().trim().min(2).max(24))
      .max(10)
      .optional()
      .openapi({
        description:
          'Solo en un torneo histórico: jugadores sin ficha (solo el nombre, de 2 a 24 caracteres, sin repetir). Fichas y nombres suman ' +
          'hasta 10. Si viene, reemplaza los nombres guardados; si no viene, no los toca (replanteo 113)',
      }),
  })
  .openapi('RegistrationBody');

export const SeedsBody = z.object({ teams: z.array(z.uuid()).max(256) }).openapi('SeedsBody');

export const SeedsResult = z
  .object({ seeds: z.array(TeamRef).openapi({ description: 'La siembra nueva, del 1 en adelante' }) })
  .openapi('SeedsResult');

export const DrawResult = z
  .object({
    seeds: z.array(TeamRef).openapi({ description: 'La siembra sorteada, del 1 en adelante' }),
    drawn_at: z.string(),
  })
  .openapi('DrawResult');
export const TieBody = z
  .object({ grp: z.number().int().min(1), order: z.array(z.uuid()).min(2) })
  .openapi('TieBody', { description: 'Orden de los equipos empatados, del mejor al peor' });

export const EventParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });
export const EventTeamParam = EventParam.extend({ teamId: z.uuid().openapi({ param: { name: 'teamId', in: 'path' } }) });

export const BANNER_HELP = 'JPEG, PNG o WebP de hasta 4 MB, de proporción 4:1, entre 800×200 y 2400×600 (el frontend lo recorta antes de subirlo).';
export const BannerUpload = z
  .object({
    file: z
      .custom<File>((v) => typeof File !== 'undefined' && v instanceof File, { message: 'Falta el archivo (campo "file").' })
      .openapi({ type: 'string', format: 'binary', description: BANNER_HELP }),
  })
  .openapi('BannerUpload');
export const BannerResult = z.object({ banner_url: z.string() }).openapi('BannerResult');

// ---------- modos de juego ----------

export const GameMode = z
  .object({
    code: z.string().openapi({ example: '5v5' }),
    name: z.string().openapi({ example: '5 vs 5' }),
    players_per_team: z.number().int(),
    active: z.boolean().openapi({ description: 'Habilitado para torneos nuevos' }),
  })
  .openapi('GameMode');
export const GameModeBody = z
  .object({ code: z.string().max(5), active: z.boolean() })
  .openapi('GameModeBody', { description: 'Habilitar o deshabilitar un modo. Tiene que quedar al menos uno habilitado' });

// ---------- aprobación y torneos históricos ----------

export const ReviewBody = z
  .object({
    approve: z.boolean(),
    note: z.string().trim().max(500).optional().openapi({ description: 'Motivo del rechazo (obligatorio al rechazar; lo ve el organizador)' }),
  })
  .refine((b) => b.approve || !!b.note, { message: 'Para rechazarlo escribí el motivo.', path: ['note'] })
  .openapi('ReviewBody');

export const HistoricTeamBody = z
  .object({
    name: z.string().trim().min(2).max(40),
    tag: z.string().trim().min(1).max(6),
  })
  .openapi('HistoricTeamBody', { description: 'Equipo que no está en la plataforma: nombre y sigla. El logo, con PUT /teams/{id}/logo' });

export const SimilarTeamQuery = listQuery(['name'], { sort: 'name', order: 'asc' }, 10).extend({
  q: z.string().trim().min(2).max(40).openapi({ description: 'Nombre o sigla del equipo que se va a cargar' }),
});
export const SimilarTeam = z
  .object({
    id: z.uuid(), name: z.string(), tag: z.string().nullable(), logo_url: z.string().nullable(),
    kind: z.enum(['official', 'historic']).openapi({ description: '`official`: está en la plataforma; `historic`: equipo histórico ya cargado' }),
  })
  .openapi('SimilarTeam');
export const SimilarTeamList = Envelope(SimilarTeam).openapi('SimilarTeamList');

export const PendingGameQuery = listQuery(['played_at'], { sort: 'played_at', order: 'desc' }).extend({
  match: z.uuid().optional().openapi({ description: 'Solo los de una partida' }),
});
export const PendingGame = z
  .object({
    game: z
      .object({
        id: z.uuid(), map: z.string().nullable(),
        score1: z.number().int().nullable().openapi({ description: 'Rondas del equipo 1 de la partida' }), score2: z.number().int().nullable(),
        played_at: z.string().nullable(),
      })
      .openapi({ description: 'El mix vinculado (las rondas ya en el orden de los equipos de la partida)' }),
    match: MatchSummary.openapi({ description: 'La partida de torneo a la que está vinculado' }),
  })
  .openapi('PendingGame');
export const PendingGameList = Envelope(PendingGame).openapi('PendingGameList');
