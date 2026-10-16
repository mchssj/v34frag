import { z } from '@hono/zod-openapi';
import { boolParam, Envelope, listQuery } from '../lib/list';

// Configuración del ELO, vista previa, simulación y recálculo (plan docs/bitacora/2026-10-16-api-elo-config).
// Los rangos son los de elo_set_config.

const int = (min: number, max: number, description: string) =>
  z.number().int().min(min, `Entre ${min} y ${max}`).max(max, `Entre ${min} y ${max}`).openapi({ description });

export const EloValues = z
  .object({
    base: int(5, 100, 'ELO que gana o pierde cada uno con equipos parejos'),
    bonus_max: int(0, 20, 'Tope del bonus (o castigo) por rendimiento'),
    bonus_factor: z.number().min(0, 'Entre 0 y 50').max(50, 'Entre 0 y 50').openapi({ description: 'Bonus por cada punto de rating sobre (o bajo) 1,00' }),
    elo_floor: int(0, 1000, 'Nadie baja de este ELO'),
    start_elo: int(100, 5000, 'ELO con el que empieza un jugador nuevo (no menor que `elo_floor`)'),
    min_pct: int(1, 100, 'Con menos de este % de las rondas jugadas no cambia el ELO'),
    full_pct: int(1, 100, 'Desde este % de las rondas cuenta completo (entre `min_pct` y 100)'),
  })
  .superRefine((v, ctx) => {
    if (v.start_elo < v.elo_floor) ctx.addIssue({ code: 'custom', path: ['start_elo'], message: 'No puede ser menor que el ELO mínimo' });
    if (v.full_pct < v.min_pct) ctx.addIssue({ code: 'custom', path: ['full_pct'], message: 'No puede ser menor que el mínimo de participación' });
  })
  .openapi('EloValues');

export const CONFIRM_TEXT = 'estoy seguro';
const confirm = z
  .string()
  .openapi({ description: `Doble confirmación: el texto \`${CONFIRM_TEXT}\` que escribió el admin` })
  .refine((v) => v.trim().toLowerCase() === CONFIRM_TEXT, { message: `Para recalcular, escribe "${CONFIRM_TEXT}".` });

export const EloConfigPut = z
  .object({
    config: EloValues,
    recompute: z.boolean().default(false).openapi({ description: 'Además, recalcular todo el historial con los valores nuevos' }),
    confirm: confirm.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.recompute && v.confirm === undefined)
      ctx.addIssue({ code: 'custom', path: ['confirm'], message: `Para recalcular, escribe "${CONFIRM_TEXT}".` });
  })
  .openapi('EloConfigPut');

export const RecomputeBody = z.object({ confirm }).openapi('EloRecompute');

export const EloConfig = z
  .object({
    config: EloValues,
    updated_at: z.string().nullable(),
    updated_by: z.object({ id: z.uuid(), alias: z.string().nullable() }).nullable().openapi({ description: 'Solo para un admin' }),
  })
  .openapi('EloConfig');

export const EloSaved = z
  .object({
    config: EloValues,
    recomputed: z.number().int().nullable().openapi({ description: 'Mixes recalculados, o `null` si no se recalculó' }),
  })
  .openapi('EloSaved');

export const Recomputed = z.object({ recomputed: z.number().int().openapi({ description: 'Mixes recalculados' }) }).openapi('EloRecomputed');

const Pair = z.object({ rating: z.number(), win: z.number().int().nullable(), lose: z.number().int().nullable() });
export const EloPreview = z
  .object({
    even: Pair.openapi({ description: 'Equipos parejos, rating 1,00' }),
    high_rating: Pair,
    low_rating: Pair,
    new_player: z.object({ elo: z.number().int(), level: z.number().int().nullable() }),
    floor: z.number().int(),
    participation: z
      .array(Pair.extend({ rounds: z.number().int(), total: z.number().int(), pct: z.number().int(), weight: z.number() }))
      .openapi({ description: '`win` y `lose` en `null`: no llega al mínimo y su ELO no cambia' }),
  })
  .openapi('EloPreview');

export const SimulateQuery = listQuery(['abs_delta', 'delta', 'elo_after', 'elo_before', 'name'], { sort: 'abs_delta', order: 'desc' }).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en el nombre y el SteamID' }),
  changed: boolParam('Solo los que cambian (o los que no)'),
});

export const SimulatedPlayer = z
  .object({
    steam_id: z.string(),
    player_id: z.uuid().nullable(),
    name: z.string().nullable().openapi({ description: 'Nombre de la ficha, o el último que usó en el juego' }),
    elo_before: z.number().int().nullable().openapi({ description: '`null`: hoy no tiene ELO' }),
    elo_after: z.number().int().nullable().openapi({ description: '`null`: con los valores nuevos no tendría ELO' }),
    delta: z.number().int(),
    matches_before: z.number().int(),
    matches_after: z.number().int(),
    changed: z.boolean(),
  })
  .openapi('EloSimulatedPlayer');
export const SimulationList = Envelope(SimulatedPlayer).openapi('EloSimulation');
