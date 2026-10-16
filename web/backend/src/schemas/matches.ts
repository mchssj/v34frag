import { z } from '@hono/zod-openapi';
import { PageQuery } from '../lib/db';
import { Paginated } from './common';
import { TeamRef } from './players';

const num = z.number().nullable();

export const MatchKind = z.enum(['mix', 'pcw', 'official']);

export const MatchListQuery = PageQuery.extend({
  kind: MatchKind.optional().openapi({ description: '`official` (torneo), `pcw` o `mix`. Sin filtro: todas' }),
  status: z.enum(['upcoming', 'live', 'finished', 'cancelled']).optional(),
  event: z.uuid().optional().openapi({ description: 'Partidas de un torneo' }),
  team: z.uuid().optional().openapi({ description: 'Partidas de un equipo' }),
});

const Side = z
  .object({
    name: z.string().nullable().openapi({ description: 'Nombre del equipo o del bando del mix' }),
    team: TeamRef.nullable().openapi({ description: 'Equipo (torneo o PCW); null en un mix o si todavía no se definió' }),
    score: num.openapi({ description: 'Mapas ganados (serie) o rondas (mix)' }),
  })
  .openapi('MatchSide');

export const MatchSummary = z
  .object({
    id: z.uuid(),
    kind: MatchKind,
    status: z.enum(['upcoming', 'live', 'finished', 'cancelled']),
    label: z.string().nullable().openapi({ description: 'Fase en un torneo ("Semifinal", "Grupo A · fecha 2"…)' }),
    event: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    side1: Side,
    side2: Side,
    winner_side: z.number().int().nullable().openapi({ description: '1, 2 o null (sin terminar o empate)' }),
    best_of: z.number().int(),
    map: z.string().nullable(),
    starts_at: z.string().nullable(),
    played_at: z.string().nullable(),
    end_reason: z.string().nullable().openapi({ description: '`surrender` (rendición) o `walkover` (W.O.)' }),
    demo_status: z.string(),
    parent_match_id: z.uuid().nullable().openapi({ description: 'Mix vinculado con !match: la partida de torneo o PCW a la que pertenece' }),
  })
  .openapi('MatchSummary');

export const MatchList = Paginated(MatchSummary).openapi('MatchList');

export const RosterPlayer = z
  .object({ player_id: z.uuid().nullable(), alias: z.string(), guest: z.boolean().openapi({ description: 'Invitado sin ficha (solo PCW)' }) })
  .openapi('RosterPlayer');

export const GameRef = z
  .object({
    id: z.uuid(),
    map: z.string().nullable(),
    score1: num.openapi({ description: 'Rondas del bando 1 de la partida' }),
    score2: num,
    played_at: z.string().nullable(),
    demo_url: z.string().nullable(),
  })
  .openapi('GameRef');

export const PlayerLine = z
  .object({
    player_id: z.uuid().nullable(),
    alias: z.string().nullable().openapi({ description: 'Alias si está vinculado; si no, null' }),
    game_nick: z.string().nullable(),
    side: z.number().int().nullable(),
    kills: num, deaths: num, assists: num, headshots: num, damage: num, rounds: num, rating: num,
    elo_delta: num,
  })
  .openapi('PlayerLine');

export const VetoState = z
  .object({
    pool: z.array(z.object({ name: z.string(), versions: z.array(z.string()) })),
    actions: z.array(z.object({ seq: z.number().int(), team_id: z.uuid().nullable(), map: z.string(), action: z.enum(['ban', 'pick']), version: z.string().nullable() })),
    sequence: z.array(z.enum(['ban', 'pick'])).openapi({ description: 'Orden de acciones según el BO' }),
    next: z.object({ team_id: z.uuid().nullable(), action: z.enum(['ban', 'pick']) }).nullable().openapi({ description: 'null si el veto terminó' }),
    maps_to_play: z.array(z.object({ map: z.string(), version: z.string(), decider: z.boolean() })).openapi({ description: 'Cuando termina: los picks en orden y el decisivo' }),
  })
  .openapi('VetoState');

export const MatchDetail = MatchSummary.extend({
  stage: z.string().nullable(),
  phase: z.number().int().nullable(),
  grp: z.number().int().nullable(),
  round: z.number().int().nullable(),
  advantage_side: z.number().int().nullable().openapi({ description: 'Gran final con mapa de ventaja: bando que empezó 1-0' }),
  cancel_reason: z.string().nullable(),
  server: z.object({ id: z.uuid().nullable(), name: z.string().nullable(), address: z.string().nullable() }).nullable(),
  demo_url: z.string().nullable().openapi({ description: 'Mix con la demo subida: link de descarga' }),
  link_code: z.string().nullable().openapi({ description: 'Código de !match: solo para los dos equipos, el organizador y los admins' }),
  roster1: z.array(RosterPlayer),
  roster2: z.array(RosterPlayer),
  maps_detail: z.array(z.object({ map: z.string().nullable(), r1: num, r2: num, game_id: z.uuid().nullable() })).openapi({ description: 'Torneo o PCW: mapas de la serie' }),
  games: z.array(GameRef).openapi({ description: 'Torneo o PCW: mixes vinculados con !match (cada uno con sus stats en su propio detalle)' }),
  players: z.array(PlayerLine).openapi({ description: 'Mix: stats de cada jugador' }),
  mvp: PlayerLine.nullable().openapi({ description: 'Mix: el de mejor rating' }),
  veto: VetoState.nullable().openapi({ description: 'Torneo o PCW' }),
  viewer: z
    .object({ can_veto: z.boolean(), can_chat: z.boolean(), can_manage: z.boolean(), is_participant: z.boolean() })
    .nullable()
    .openapi({ description: 'Qué puede hacer quien consulta (null sin sesión)' }),
}).openapi('MatchDetail');

export const ChatMessage = z
  .object({ id: z.number().int(), user_id: z.uuid().nullable(), alias: z.string(), message: z.string(), created_at: z.string() })
  .openapi('ChatMessage');

export const ChatQuery = z.object({
  after: z.coerce.number().int().optional().openapi({ description: 'Solo los mensajes con id mayor (para consultar los nuevos)' }),
});

export const ChatBody = z.object({ message: z.string().trim().min(1).max(300) }).openapi('ChatBody');
export const VetoBody = z
  .object({ map: z.string().min(1).max(40), version: z.string().min(1).max(40).optional() })
  .openapi('VetoBody');

export const ScheduleBody = z
  .object({
    starts_at: z.iso.datetime({ offset: true }).nullable().optional(),
    server_id: z.uuid().nullable().optional(),
  })
  .refine((b) => b.starts_at !== undefined || b.server_id !== undefined, { message: 'No hay nada para actualizar.' })
  .openapi('ScheduleBody');

export const MapScore = z.object({
  map: z.string().trim().max(40).optional(),
  r1: z.number().int().min(0).max(99),
  r2: z.number().int().min(0).max(99),
});

export const ResultBody = z
  .object({
    maps: z.array(MapScore).min(1).max(5).optional().openapi({ description: 'Mapas jugados con las rondas de cada equipo' }),
    walkover: z.uuid().optional().openapi({ description: 'W.O.: id del equipo que gana (el que se presentó)' }),
    clear: z.literal(true).optional().openapi({ description: 'Anula el resultado y la partida vuelve a pendiente' }),
  })
  .refine((b) => [b.maps, b.walkover, b.clear].filter((x) => x !== undefined).length === 1, { message: 'Mandá maps, walkover o clear (uno solo).' })
  .openapi('ResultBody');

export const MatchParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });
export const ChatParam = z.object({ id: z.coerce.number().int().openapi({ param: { name: 'id', in: 'path' } }) });
