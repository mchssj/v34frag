import { z } from '@hono/zod-openapi';
import { Envelope, listQuery } from '../lib/list';

// Clips automáticos: las jugadas destacadas de cada partida (plan docs/bitacora/2026-10-22-clips-automaticos).
// La base clasifica, ordena y aplica los topes (vista match_clip_list); los rangos son los de clip_set_config.

export const CLIP_TYPES = ['ace', 'clutch_5', 'clutch_4', '4k', 'clutch_3', '3k', 'clutch_2', 'clutch_1'] as const;

export const ClipListQuery = listQuery(['position', 'round'], { sort: 'position', order: 'asc' }, 50).extend({
  player: z.uuid().optional().openapi({ description: 'Solo los clips de esta ficha' }),
  type: z.enum(CLIP_TYPES).optional().openapi({ description: 'Solo los de este tipo' }),
});

export const Clip = z
  .object({
    id: z.uuid(),
    position: z.number().int().openapi({ description: 'Puesto dentro de la partida: 1 es la mejor jugada' }),
    type: z.enum(CLIP_TYPES).openapi({ description: '`ace` (5 kills), `4k`, `3k` o `clutch_N` (1vN ganado). El de más prioridad entre sus kills y su clutch' }),
    priority: z.number().int().openapi({ description: 'Prioridad del tipo en la escala actual: 1 es lo más valioso' }),
    round: z.number().int().openapi({ description: 'Ronda de la partida (la prórroga sigue numerando)' }),
    round_seconds: z.number().int().openapi({ description: 'Segundos desde el fin del freezetime hasta la primera kill (o el inicio del clutch)' }),
    round_won: z.boolean().openapi({ description: 'Si su equipo ganó la ronda' }),
    player: z.object({ id: z.uuid(), alias: z.string() }).nullable().openapi({ description: 'La ficha (por su SteamID principal o uno adicional). `null` sin ficha' }),
    game_nick: z.string().openapi({ description: 'Nick en el juego en esa partida' }),
    steam_id: z.string().nullable().openapi({ description: 'SteamID64 si no tiene ficha, para el perfil sin reclamar. `null` con ficha, bots y NOSTEAM' }),
    kills: z.number().int().openapi({ description: 'Kills en la ronda (0 a 5)' }),
    kill_ticks: z.array(z.number().int()).openapi({ description: 'Tick de la demo de cada kill, en orden' }),
    clutch_vs: z.number().int().nullable().openapi({ description: 'Contra cuántos quedó solo (1 a 5). `null` sin clutch' }),
    clutch_start_tick: z.number().int().nullable().openapi({ description: 'Tick de la demo en que quedó solo' }),
    end_tick: z.number().int().nullable().openapi({ description: 'Tick de la demo en que terminó la ronda (solo con clutch)' }),
    tickrate: z.number().int().nullable().openapi({ description: 'Ticks por segundo de la partida. `null` en partidas viejas' }),
    demo_seconds: z.number().nullable().openapi({ description: 'Segundo de la demo donde empieza la jugada (primer tick / tickrate). `null` sin tickrate' }),
  })
  .openapi('Clip');

export const ClipList = Envelope(Clip).openapi('ClipList');

const int = (min: number, max: number, description: string) =>
  z.number().int().min(min, `Entre ${min} y ${max}`).max(max, `Entre ${min} y ${max}`).openapi({ description });

export const ClipPriorities = z
  .object(Object.fromEntries(CLIP_TYPES.map((t) => [t, int(1, 99, `Prioridad de \`${t}\` (1 es lo más valioso)`)])) as Record<
    (typeof CLIP_TYPES)[number],
    ReturnType<typeof int>
  >)
  .strict()
  .openapi('ClipPriorities');

export const ClipConfigValues = z
  .object({
    priorities: ClipPriorities,
    per_player: int(1, 10, 'Clips por jugador en cada partida (por ficha; un SteamID sin ficha cuenta solo)'),
    per_match: int(1, 50, 'Clips por partida'),
    split_gap_seconds: int(1, 60, 'Para el video (fase C): más segundos que esto entre dos kills parte el clip en tramos'),
    pre_seconds: int(0, 15, 'Para el video (fase C): segundos antes de la primera kill'),
    post_seconds: int(0, 15, 'Para el video (fase C): segundos después de la última kill'),
  })
  .openapi('ClipConfigValues');

export const ClipConfig = z
  .object({
    config: ClipConfigValues,
    updated_at: z.string().nullable(),
    updated_by: z.object({ id: z.uuid(), alias: z.string().nullable() }).nullable(),
  })
  .openapi('ClipConfig');

export const ClipConfigPatch = z
  .object({
    priorities: ClipPriorities.partial().optional().openapi({ description: 'Solo los tipos que cambian' }),
    per_player: ClipConfigValues.shape.per_player.optional(),
    per_match: ClipConfigValues.shape.per_match.optional(),
    split_gap_seconds: ClipConfigValues.shape.split_gap_seconds.optional(),
    pre_seconds: ClipConfigValues.shape.pre_seconds.optional(),
    post_seconds: ClipConfigValues.shape.post_seconds.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Mandá al menos un valor')
  .openapi('ClipConfigPatch', { description: 'Solo lo que cambia. Se aplica al listado de todas las partidas al instante: los datos no se tocan' });
