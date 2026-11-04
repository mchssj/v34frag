import { z } from '@hono/zod-openapi';
import { Envelope, listQuery } from '../lib/list';
import { MedalKey } from './admin';

// Administración › Medallas (replanteo 72, docs/bitacora/2026-11-04-medallas-automaticas).

const Source = z.enum(['admin', 'auto', 'temporada']);

export const AdminMedalQuery = listQuery(['created_at', 'title'], { sort: 'created_at', order: 'desc' }).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en el alias del jugador' }),
  season: z.string().max(40).optional().openapi({ description: 'id de la temporada, o `none` para las de carrera' }),
  medal_key: MedalKey.optional(),
  source: Source.optional().openapi({ description: '`admin`, `auto` o `temporada`' }),
});

export const AdminMedal = z
  .object({
    id: z.uuid(),
    title: z.string(),
    icon: z.string().nullable(),
    medal_key: z.string().nullable(),
    source: Source,
    created_at: z.string(),
    rank: z.number().int().nullable(),
    season: z.object({ id: z.uuid(), number: z.number().int(), name: z.string() }).nullable(),
    player: z.object({ id: z.uuid(), nick: z.string(), photo_url: z.string().nullable() }),
  })
  .openapi('AdminMedal');
export const AdminMedalList = Envelope(AdminMedal).openapi('AdminMedalList');

export const MedalGrantBody = z
  .object({
    title: z.string().trim().min(1).max(80),
    icon: z.string().trim().min(1).max(8).default('🏅').openapi({ description: 'Un emoji (para la web vieja y si no hay dibujo)' }),
    medal_key: MedalKey.optional(),
    season_id: z.uuid().nullable().optional().openapi({ description: 'Temporada; sin esto (o `null`), es de carrera' }),
    player_ids: z.array(z.uuid()).min(1).max(500).openapi({ description: 'Jugadores (hasta 500)' }),
  })
  .openapi('MedalGrantBody');
export const MedalGrantResult = z
  .object({
    given: z.number().int().openapi({ description: 'Medallas dadas' }),
    skipped: z.array(z.uuid()).openapi({ description: 'Jugadores que ya la tenían en esa temporada (no se repite)' }),
  })
  .openapi('MedalGrantResult');

export const MedalPatchBody = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    season_id: z.uuid().nullable().optional().openapi({ description: 'Otra temporada, o `null` para que sea de carrera' }),
  })
  .refine((b) => b.title !== undefined || b.season_id !== undefined, { message: 'Mandá title o season_id' })
  .openapi('MedalPatchBody');

export const MedalIdsBody = z.object({ ids: z.array(z.uuid()).min(1).max(500) }).openapi('MedalIdsBody');
export const MedalDeleted = z.object({ deleted: z.number().int() }).openapi('MedalDeleted');

export const MedalRule = z
  .object({
    medal_key: z.string(),
    metric: z.string(),
    threshold: z.number(),
    title: z.string(),
    min_matches: z.number().int(),
    icon: z.string(),
    active: z.boolean(),
  })
  .openapi('MedalRule');
export const MedalRuleList = z.object({ items: z.array(MedalRule) }).openapi('MedalRuleList');
export const MedalRuleParam = z.object({ key: MedalKey.openapi({ param: { name: 'key', in: 'path' } }) });
export const MedalRulePatch = z
  .object({
    threshold: z.number().positive().optional(),
    min_matches: z.number().int().min(0).max(10000).optional(),
    title: z.string().trim().min(1).max(80).optional(),
    active: z.boolean().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: 'Mandá al menos un campo' })
  .openapi('MedalRulePatch');
export const MedalRecalc = z.object({ given: z.number().int().openapi({ description: 'Medallas automáticas nuevas' }) }).openapi('MedalRecalc');
