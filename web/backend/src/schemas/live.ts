import { z } from '@hono/zod-openapi';
import { boolParam, Envelope, listQuery } from '../lib/list';
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
