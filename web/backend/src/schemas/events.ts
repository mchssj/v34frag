import { z } from '@hono/zod-openapi';
import { PageQuery } from '../lib/db';
import { Paginated } from './common';
import { MatchSummary } from './matches';
import { TeamRef } from './players';

export const Template = z.enum(['single', 'double', 'groups', 'swiss']).openapi({
  description: '`single` eliminación directa, `double` doble eliminación, `groups` grupos + playoffs, `swiss` suizo + playoffs',
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
    // groups
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
      'swiss 1 fase de 16, 3 victorias, BO1 y decisivas BO3, playoffs BO3. 3.er puesto apagado.',
  });

export const EventListQuery = PageQuery.extend({ status: EventStatus.optional() });

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

export const EventList = Paginated(EventSummary).openapi('EventList');

export const Registration = z
  .object({
    team: TeamRef,
    seed: z.number().int().openapi({ description: 'Posición en la siembra (1 = cabeza de serie)' }),
    start_stage: z.number().int().openapi({ description: 'Suizo: fase en la que empieza' }),
    players: z.array(z.object({ player_id: z.uuid(), alias: z.string() })),
  })
  .openapi('Registration');

export const GroupRow = z
  .object({
    team: TeamRef, place: z.number().int(), tied: z.boolean().openapi({ description: 'Empatado en todos los criterios con el de al lado' }),
    played: z.number().int(), won: z.number().int(), lost: z.number().int(), points: z.number().int(),
    rounds_for: z.number().int(), rounds_against: z.number().int(), rounds_diff: z.number().int(),
  })
  .openapi('GroupRow');

export const SwissRow = z
  .object({
    team: TeamRef, wins: z.number().int(), losses: z.number().int(), buchholz: z.number().int(), rounds_diff: z.number().int(),
    state: z.enum(['active', 'qualified', 'eliminated']),
  })
  .openapi('SwissRow');

export const EventDetail = EventSummary.extend({
  rules: z.string().nullable(),
  min_teams: z.number().int().nullable(),
  players_min: z.number().int(),
  players_max: z.number().int(),
  config: z.record(z.string(), z.unknown()).openapi({ description: 'Configuración completa (con los valores por defecto)' }),
  tie_pending: z.object({ grp: z.number().int() }).nullable().openapi({ description: 'Empate de grupo que tiene que resolver el organizador' }),
  registrations: z.array(Registration),
  groups: z.array(z.object({ grp: z.number().int(), name: z.string(), rows: z.array(GroupRow) })),
  swiss: z.array(z.object({ phase: z.number().int(), rows: z.array(SwissRow) })),
  matches: z.array(MatchSummary.extend({ stage: z.string().nullable(), phase: z.number().int().nullable(), grp: z.number().int().nullable(), round: z.number().int().nullable(), pos: z.number().int().nullable() })),
  viewer: z.object({ can_manage: z.boolean() }).nullable(),
}).openapi('EventDetail');

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
export const TieBody = z
  .object({ grp: z.number().int().min(1), order: z.array(z.uuid()).min(2) })
  .openapi('TieBody', { description: 'Orden de los equipos empatados, del mejor al peor' });

export const EventParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });
export const EventTeamParam = EventParam.extend({ teamId: z.uuid().openapi({ param: { name: 'teamId', in: 'path' } }) });
