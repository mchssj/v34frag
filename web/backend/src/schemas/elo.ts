import { z } from '@hono/zod-openapi';
import { dateParam, Envelope, listQuery } from '../lib/list';
import { confirmField } from './common';

// Configuración del ELO y vista previa (plan docs/bitacora/2026-10-16-api-elo-config) y ajustes manuales.
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

export const EloConfigPut = z
  .object({ config: EloValues })
  .openapi('EloConfigPut', { description: 'Vale para los mixes nuevos. Desde la web ya no se recalcula el historial' });

export const EloConfig = z
  .object({
    config: EloValues,
    updated_at: z.string().nullable(),
    updated_by: z.object({ id: z.uuid(), alias: z.string().nullable() }).nullable().openapi({ description: 'Solo para un admin' }),
  })
  .openapi('EloConfig');

export const EloSaved = z.object({ config: EloValues }).openapi('EloSaved');

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

// ---------- ajustes manuales (plan docs/bitacora/2026-10-21-ajustes-elo-admin) ----------

export const AdjustBody = z
  .object({
    player_ids: z
      .array(z.uuid())
      .min(1, 'Elegí al menos un jugador')
      .max(10, 'Hasta 10 jugadores')
      .refine((ids) => new Set(ids).size === ids.length, { message: 'Sin repetir jugadores' })
      .openapi({ description: 'Fichas a ajustar (de 1 a 10), todas con SteamID' }),
    delta: z.number().int().min(-500, 'Entre -500 y +500').max(500, 'Entre -500 y +500').refine((v) => v !== 0, { message: 'No puede ser 0' })
      .optional().openapi({ description: 'Sumar (o restar, en negativo)' }),
    set_elo: z.number().int().min(0, 'Entre 0 y 10000').max(10000, 'Entre 0 y 10000').optional()
      .openapi({ description: 'Fijar el ELO en este valor (con el piso de la configuración)' }),
    reason: z.string().trim().min(1, 'El motivo es obligatorio').max(200).openapi({ description: 'Lo ve el jugador en su perfil' }),
  })
  .superRefine((v, ctx) => {
    if ((v.delta === undefined) === (v.set_elo === undefined))
      ctx.addIssue({ code: 'custom', path: ['delta'], message: 'Elegí sumar o restar (`delta`) o fijar (`set_elo`), uno de los dos' });
  })
  .openapi('EloAdjustBody');

export const AdjustResult = z
  .object({
    items: z.array(
      z.object({
        adjustment_id: z.number().int().nullable().openapi({ description: '`null`: con "fijar", ya tenía ese ELO y no se ajustó' }),
        player: z.object({ id: z.uuid(), alias: z.string() }),
        elo_before: z.number().int(),
        elo_after: z.number().int(),
      }),
    ),
  })
  .openapi('EloAdjustResult');

const adjustmentFields = {
  id: z.number().int(),
  kind: z.enum(['delta', 'set']).openapi({ description: '`delta`: sumó o restó; `set`: fijó el ELO en `set_elo`' }),
  delta: z.number().int().openapi({ description: 'Cambio (en `set`, el que hubo al hacerlo)' }),
  set_elo: z.number().int().nullable(),
  reason: z.string(),
  applied_at: z.string(),
};
export const PlayerAdjustment = z.object(adjustmentFields).openapi('EloPlayerAdjustment');
export const PlayerAdjustmentQuery = listQuery(['applied_at'], { sort: 'applied_at', order: 'desc' });
export const PlayerAdjustmentList = Envelope(PlayerAdjustment).openapi('EloPlayerAdjustmentList');

export const AdminAdjustment = z
  .object({
    ...adjustmentFields,
    player: z.object({ id: z.uuid(), alias: z.string() }).nullable().openapi({ description: '`null` si el SteamID ya no es de ninguna ficha' }),
    steam_id: z.string(),
    created_by: z.object({ id: z.uuid(), alias: z.string().nullable() }).nullable(),
  })
  .openapi('EloAdminAdjustment');
export const AdminAdjustmentQuery = listQuery(['applied_at', 'delta'], { sort: 'applied_at', order: 'desc' }).extend({
  player: z.uuid().optional().openapi({ description: 'Solo los de esta ficha' }),
  q: z.string().max(60).optional().openapi({ description: 'Busca en el alias, el motivo y el SteamID' }),
  from: dateParam('Hechos desde'),
  to: dateParam('Hechos hasta'),
});
export const AdminAdjustmentList = Envelope(AdminAdjustment).openapi('EloAdminAdjustmentList');

export const AdjustmentIdParam = z.object({ id: z.coerce.number().int().positive().openapi({ param: { name: 'id', in: 'path' } }) });
export const UndoBody = z.object({ confirm: confirmField('deshacer el ajuste') }).openapi('EloAdjustUndo');
