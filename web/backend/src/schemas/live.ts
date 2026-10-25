import { z } from '@hono/zod-openapi';
import { boolParam, dateParam, Envelope, listQuery } from '../lib/list';
import { confirmField } from './common';

const num = z.number().nullable();

// Mixes en vivo: la última foto que mandó el servidor al final de cada ronda (plan docs/bitacora/2026-10-17-api-mixes-en-vivo).

export const LiveMixQuery = listQuery(['updated_at', 'started_at'], { sort: 'updated_at', order: 'desc' }).extend({
  server: z.uuid().optional().openapi({ description: 'Mixes de un servidor' }),
  player: z.uuid().optional().openapi({ description: 'Mixes donde juega un jugador (por su ficha)' }),
  map: z.string().max(40).optional().openapi({ description: 'Mapa (contiene)' }),
  stale: boolParam('`true`: sin fotos hace más de 10 minutos (el servidor pudo caerse y no volver); `false`: el resto'),
  q: z.string().max(60).optional().openapi({ description: 'Busca en bandos, jugadores, mapa y servidor' }),
});

export const UidParam = z.object({
  uid: z
    .string()
    .regex(/^[A-Za-z0-9_-]{6,70}$/)
    .openapi({ param: { name: 'uid', in: 'path' }, description: 'match_uid del servidor (por ejemplo `srv1-20261017T195321-f890`)' }),
});

/** SourceTV del servidor, para "Ver en TV" (`steam://connect/{host}:{port}`). */
export const TvRef = z
  .object({ host: z.string(), port: z.number().int() })
  .openapi('TvRef', { description: 'SourceTV del servidor. null si el servidor no tiene cargado el puerto (`tv_port`)' });

const LiveSide = z
  .object({ name: z.string().nullable().openapi({ description: '"Equipo <nick>" o "Mix de <el que más mató>"' }), score: num })
  .openapi('LiveSide');

export const LiveMixSummary = z
  .object({
    uid: z.string(),
    server: z.object({ id: z.uuid(), name: z.string().nullable() }),
    map: z.string().nullable(),
    side1: LiveSide,
    side2: LiveSide,
    rounds_played: z.number().int(),
    max_rounds: z.number().int().nullable().openapi({ description: 'Rondas del mix (sin prórroga)' }),
    started_at: z.string().nullable(),
    updated_at: z.string().openapi({ description: 'Llegada de la última foto (fin de la última ronda)' }),
    stale: z.boolean().openapi({ description: 'Sin fotos hace más de 10 minutos: un admin lo puede cerrar como interrumpido' }),
    parent_match_id: z.uuid().nullable().openapi({ description: 'Vinculado con !match: la partida de torneo o PCW abierta' }),
    tv: TvRef.nullable(),
  })
  .openapi('LiveMixSummary');

export const LiveMixList = Envelope(LiveMixSummary).openapi('LiveMixList');

export const LivePlayerLine = z
  .object({
    player_id: z.uuid().nullable(),
    alias: z.string().nullable().openapi({ description: 'Alias si tiene ficha; si no, null' }),
    game_nick: z.string(),
    steam_id: z.string().nullable().openapi({ description: 'Solo si no tiene ficha: enlaza al perfil sin reclamar' }),
    side: z.number().int().nullable(),
    kills: num, deaths: num, assists: num, headshots: num, damage: num, rounds: num, rating: num,
    // (replanteo 29) de la foto parcial; los clutches llegan con el resultado.
    k2: num, k3: num, k4: num, k5: num, first_kills: num, first_deaths: num, plants: num, defuses: num,
  })
  .openapi('LivePlayerLine');

export const LiveMixDetail = LiveMixSummary.extend({
  seq: z.number().int().openapi({ description: 'Número de foto: sube en cada ronda (con !rr el marcador puede bajar)' }),
  rounds: z
    .array(
      z.object({
        n: z.number().int(),
        winner_side: z.number().int().nullable().openapi({ description: 'Bando que ganó la ronda (1 o 2)' }),
        side1_as: z.enum(['CT', 'T']).nullable().openapi({ description: 'Lado del bando 1 en esa ronda' }),
        reason: z.number().int().nullable().openapi({ description: 'Motivo del fin de ronda del motor' }),
      }),
    )
    .openapi({ description: 'Rondas jugadas en orden' }),
  players: z.array(LivePlayerLine).openapi({ description: 'Stats parciales, por bando y de mejor a peor rating' }),
}).openapi('LiveMixDetail');

/** Juego en curso de una partida de torneo o PCW, con el marcador en el orden de los bandos de la partida. */
export const LiveGameRef = z
  .object({
    uid: z.string(),
    map: z.string().nullable(),
    score1: num.openapi({ description: 'Rondas del bando 1 de la partida' }),
    score2: num,
    rounds_played: z.number().int(),
    max_rounds: z.number().int().nullable(),
    updated_at: z.string(),
    stale: z.boolean(),
  })
  .openapi('LiveGameRef');

export const ApplyEloBody = z.object({ confirm: confirmField('aplicar el ELO del mix interrumpido') }).openapi('ApplyEloBody');

export const ClosedMix = z.object({ match_id: z.uuid().openapi({ description: 'La partida creada como interrumpida' }) }).openapi('ClosedMix');

// ---------- listado único de mixes (plan docs/bitacora/2026-10-24-api-mixes-perfil-ranking) ----------

export const MIX_STATUSES = ['live', 'finished', 'cancelled'] as const;

export const MixListQuery = listQuery(['started_at', 'rounds'], { sort: 'started_at', order: 'desc' }).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en bandos, mapa, servidor y nombres de los jugadores (alias y nombre del juego)' }),
  map: z.string().max(40).optional().openapi({ description: 'Mapa (contiene)' }),
  server: z.uuid().optional().openapi({ description: 'Mixes de un servidor' }),
  status: z.enum(MIX_STATUSES).optional().openapi({ description: '`live`, `finished` o `cancelled`. Sin filtro: todos' }),
  mine: boolParam('`true`: solo los mixes donde jugó el usuario (pide sesión; sin ficha, la lista viene vacía)'),
  hide_cancelled: boolParam('`true`: sin los cancelados'),
  from: dateParam('Empezados desde'),
  to: dateParam('Empezados hasta'),
});

export const MixMvp = z
  .object({
    player_id: z.uuid().nullable().openapi({ description: 'Ficha, si tiene' }),
    alias: z.string().nullable().openapi({ description: 'Alias si tiene ficha; si no, null' }),
    game_nick: z.string().nullable().openapi({ description: 'Nombre que usó en el juego' }),
    elo: z.number().int().nullable(),
    level: z.number().int().min(1).max(10).nullable(),
    rating: num,
  })
  .openapi('MixMvp');

export const MixItem = z
  .object({
    match_id: z.uuid().nullable().openapi({ description: 'Partida (terminado o cancelado): `GET /api/v1/matches/{id}`. null en vivo' }),
    live_uid: z.string().nullable().openapi({ description: 'En vivo: `GET /api/v1/mixes/live/{uid}`. null si ya terminó' }),
    status: z.enum(MIX_STATUSES),
    map: z.string().nullable(),
    server: z.object({ id: z.uuid(), name: z.string().nullable() }).nullable(),
    started_at: z.string().nullable(),
    ended_at: z.string().nullable().openapi({ description: 'null en vivo' }),
    side1: LiveSide,
    side2: LiveSide,
    winner_side: z.number().int().nullable().openapi({ description: '1, 2 o null (en vivo, cancelado o empate)' }),
    rounds_played: z.number().int(),
    current_round: z.number().int().nullable().openapi({ description: 'En vivo: la ronda que se está jugando. null si terminó' }),
    max_rounds: z.number().int().nullable().openapi({ description: 'En vivo: rondas del mix (sin prórroga)' }),
    stale: z.boolean().openapi({ description: 'En vivo sin fotos hace más de 10 minutos' }),
    mvp: MixMvp.nullable().openapi({ description: 'El de mejor rating (parcial en vivo)' }),
    demo_status: z.string().openapi({ description: '`none`, `pending`, `uploaded`, `missing` o `expired`' }),
    cancel_reason: z.string().nullable(),
    tv: TvRef.nullable().openapi({ description: 'Solo en vivo' }),
  })
  .openapi('MixItem');

export const MixList = Envelope(MixItem).openapi('MixList', {
  description: 'Con el orden por defecto (`started_at` desc) los mixes en vivo van primero',
});

export const MixStats = z
  .object({
    live_now: z.number().int().openapi({ description: 'Mixes en vivo ahora (con foto en los últimos 10 minutos)' }),
    players_recent: z.number().int().openapi({ description: 'Jugadores distintos en mixes terminados de los últimos `window_days` días' }),
    top_map: z.string().nullable().openapi({ description: 'Mapa más jugado en ese período' }),
    avg_rounds: num.openapi({ description: 'Promedio de rondas por mix en ese período' }),
    window_days: z.number().int(),
  })
  .openapi('MixStats');

export const DeleteMixBody = z
  .object({
    elo: z.enum(['keep', 'revert']).openapi({
      description: '`keep`: el ELO que dio el mix se mantiene; `revert`: se le resta a cada jugador. Nunca recalcula la historia',
    }),
    confirm: confirmField('borrar el mix'),
  })
  .openapi('DeleteMixBody');

export const DeletedMix = z
  .object({
    elo_mode: z.enum(['keep', 'revert', 'none']).openapi({ description: '`none`: el mix no había movido el ELO' }),
    players: z.number().int().openapi({ description: 'Jugadores cuyo ELO se mantuvo o se revirtió' }),
  })
  .openapi('DeletedMix');
