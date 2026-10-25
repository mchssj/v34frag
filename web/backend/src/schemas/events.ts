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
  from: dateParam('Empiezan desde esta fecha'),
  to: dateParam('Empiezan hasta esta fecha'),
});

export const EventSummary = z
  .object({
    id: z.uuid(),
    name: z.string(),
    template: Template,
    status: EventStatus,
    starts_on: z.string().nullable(),
    ends_on: z.string().nullable(),
    prize: z.string().nullable(),
    teams: z.number().int().openapi({ description: 'Equipos inscritos' }),
    max_teams: z.number().int().nullable(),
    champion: TeamRef.nullable(),
    organizer: z.object({ user_id: z.uuid(), alias: z.string().nullable() }).nullable(),
  })
  .openapi('EventSummary');

export const EventList = Envelope(EventSummary).openapi('EventList');

export const Registration = z
  .object({
    team: TeamRef,
    seed: z.number().int().openapi({ description: 'Posición en la siembra (1 = cabeza de serie)' }),
    start_stage: z.number().int().openapi({ description: 'Suizo: fase en la que empieza' }),
    players: z.array(z.object({ player_id: z.uuid(), alias: z.string() })),
  })
  .openapi('Registration');

export const RegistrationQuery = listQuery(['seed', 'name'], { sort: 'seed', order: 'asc' }).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en el nombre y la sigla del equipo' }),
  start_stage: z.coerce.number().int().min(1).max(3).optional(),
});
export const RegistrationList = Envelope(Registration).openapi('RegistrationList');

export const EventMatch = MatchSummary.extend({
  stage: z.string().nullable().openapi({ description: '`ko`, `third`, `upper`, `lower`, `grand`, `group` o `swiss`' }),
  phase: z.number().int().nullable(),
  grp: z.number().int().nullable(),
  round: z.number().int().nullable(),
  pos: z.number().int().nullable(),
  bye: z.boolean(),
}).openapi('EventMatch');

export const EventMatchQuery = listQuery(['bracket', 'starts_at', 'played_at'], { sort: 'bracket', order: 'asc' }, 200).extend({
  stage: z.enum(['ko', 'third', 'upper', 'lower', 'grand', 'group', 'swiss']).optional(),
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

export const EventDetail = EventSummary.extend({
  rules: z.string().nullable(),
  min_teams: z.number().int().nullable(),
  players_min: z.number().int(),
  players_max: z.number().int(),
  config: z.record(z.string(), z.unknown()).openapi({ description: 'Configuración completa (con los valores por defecto)' }),
  tie_pending: z.object({ grp: z.number().int() }).nullable().openapi({ description: 'Empate de grupo que tiene que resolver el organizador' }),
  draw: z
    .object({ at: z.string(), by: z.object({ user_id: z.uuid().nullable(), alias: z.string().nullable() }) })
    .nullable()
    .openapi({ description: 'Sorteo de la siembra (POST /events/{id}/draw): cuándo y quién. null si la siembra se cargó a mano o cambió después' }),
  map_pool: z.array(z.string()).nullable().openapi({ description: 'Pool del veto del torneo; `null`: el pool por defecto (GET /maps?veto_default=true)' }),
  viewer: z.object({ can_manage: z.boolean() }).nullable(),
}).openapi('EventDetail', {
  description: 'Inscritos, partidas y tablas van en sus propios listados: /events/{id}/registrations, /matches y /standings',
});

export const EventCreate = z
  .object({
    name: z.string().trim().min(2).max(80),
    template: Template,
    config: EventConfig.optional(),
    players_min: z.number().int().min(1).max(10).optional(),
    players_max: z.number().int().min(1).max(10).optional(),
    starts_on: z.iso.date().nullable().optional(),
    ends_on: z.iso.date().nullable().optional(),
    prize: z.string().trim().max(200).nullable().optional(),
    rules: z.string().trim().max(5000).nullable().optional(),
    min_teams: z.number().int().min(2).max(256).nullable().optional(),
    max_teams: z.number().int().min(2).max(256).nullable().optional(),
    map_pool: MapPoolNames.optional().openapi({ description: 'Pool del veto del torneo, entre los mapas disponibles del catálogo (al menos el BO más alto de `config`). `null`: el pool por defecto. No cambia después del primer veto' }),
  })
  .openapi('EventCreate');

export const EventPatch = EventCreate.partial()
  .refine((o) => Object.values(o).some((v) => v !== undefined), { message: 'No hay nada para actualizar.' })
  .openapi('EventPatch');

export const RegistrationBody = z
  .object({
    players: z.array(z.uuid()).min(1).max(10).openapi({ description: 'Jugadores del plantel con SteamID (entre players_min y players_max)' }),
    start_stage: z.number().int().min(1).max(3).optional().openapi({ description: 'Suizo: fase en la que empieza (solo el organizador)' }),
  })
  .openapi('RegistrationBody');

export const SeedsBody = z.object({ teams: z.array(z.uuid()).max(256) }).openapi('SeedsBody');

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
