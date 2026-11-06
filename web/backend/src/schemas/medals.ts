import { z } from '@hono/zod-openapi';

// Medallas configurables (replanteo 79, plan docs/bitacora/2026-11-04-medallas-configurables). Las plantillas (el SVG de
// Kyan, la métrica y qué se edita) están en web/frontend/src/features/medals/templates.json.

export const MEDAL_METALS = ['bronce', 'plata', 'oro', 'platino', 'diamante'] as const;
export const MEDAL_STATUS = ['draft', 'active', 'archived'] as const;
export const MEDAL_AGGREGATIONS = ['total', 'avg_min_matches', 'max', 'streak', 'once', 'season_rank', 'manual'] as const;

export const MedalDesign = z
  .object({
    id: z.uuid().openapi({ description: 'La definición' }),
    key: z.string(),
    template: z.string().openapi({ description: 'Id de la plantilla del manifiesto (el SVG)' }),
    title: z.string(),
    number: z.string().nullable().openapi({ description: 'El número del dibujo' }),
    label: z.string().nullable().openapi({ description: 'La etiqueta. En las de temporada, `S` y el número de la temporada' }),
    band: z.string().nullable().openapi({ description: 'Texto de la banda' }),
    metal: z.enum(MEDAL_METALS).nullable(),
    accent: z.string().nullable().openapi({ description: 'Acento de la paleta del manifiesto' }),
  })
  .openapi('MedalDesign', { description: 'Lo necesario para dibujar una medalla con <Medal>' });

const DesignInput = z
  .object({
    number: z.string().trim().max(5, 'El número: hasta 5 caracteres.').nullable().optional(),
    label: z.string().trim().max(14, 'La etiqueta: hasta 14 caracteres.').nullable().optional(),
    band: z.string().trim().max(14, 'La banda: hasta 14 caracteres.').nullable().optional(),
    metal: z.enum(MEDAL_METALS).optional(),
    accent: z.string().max(40).nullable().optional(),
  })
  .openapi('MedalDesignInput', { description: 'Solo lo que la plantilla deja editar; lo demás se descarta' });

export const MedalDefinition = z
  .object({
    id: z.uuid(),
    key: z.string(),
    template: z.string(),
    scope: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    metric: z.string(),
    aggregation: z.enum(MEDAL_AGGREGATIONS),
    filters: z.record(z.string(), z.unknown()),
    target: z.number(),
    series: z.string().nullable(),
    series_order: z.number().int().nullable(),
    status: z.enum(MEDAL_STATUS),
    retroactive: z.boolean(),
    data_since: z.string().nullable().openapi({ description: 'Desde cuándo hay datos de la métrica' }),
    activated_at: z.string().nullable(),
    created_at: z.string(),
    holders: z.number().int().openapi({ description: 'Cuántos jugadores la tienen' }),
    design: MedalDesign,
  })
  .openapi('MedalDefinition');
export const MedalDefinitionList = z.object({ items: z.array(MedalDefinition) }).openapi('MedalDefinitionList');

export const MedalDefinitionCreate = z
  .object({
    template: z.string().min(2).max(40),
    target: z.number().positive().max(1_000_000),
    title: z.string().trim().min(1).max(80).optional().openapi({ description: 'Por defecto, el formato de la plantilla con el objetivo' }),
    description: z.string().trim().min(1).max(200).nullable().optional(),
    min_matches: z.number().int().min(1).max(1000).optional().openapi({ description: 'Solo las de promedio (% HS, KDA, ADR): mínimo de mixes' }),
    design: DesignInput.default({}),
  })
  .openapi('MedalDefinitionCreate');

export const MedalDefinitionPatch = z
  .object({
    target: z.number().positive().max(1_000_000).optional().openapi({ description: 'Solo en un borrador' }),
    title: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().min(1).max(200).nullable().optional(),
    min_matches: z.number().int().min(1).max(1000).optional(),
    design: DesignInput.optional(),
  })
  .openapi('MedalDefinitionPatch');

export const MedalActivate = z
  .object({ retroactive: z.boolean().openapi({ description: 'Dársela ya a quienes la cumplen' }) })
  .openapi('MedalActivate');
export const MedalActivated = z
  .object({ definition: MedalDefinition, awarded: z.number().int().openapi({ description: 'A cuántos se la dio al activarla' }) })
  .openapi('MedalActivated');

export const MedalPreviewBody = z
  .object({
    template: z.string().min(2).max(40),
    target: z.number().positive().max(1_000_000),
    min_matches: z.number().int().min(1).max(1000).optional(),
  })
  .openapi('MedalPreviewBody');
export const MedalPreview = z
  .object({ players: z.number().int().nullable().openapi({ description: 'Quiénes la recibirían hoy; null en las de temporada y las manuales' }) })
  .openapi('MedalPreview');

export const MedalProgress = z
  .object({
    design: MedalDesign,
    series: z.string().nullable(),
    series_order: z.number().int().nullable(),
    target: z.number(),
    value: z.number().openapi({ description: 'Lo que lleva el jugador' }),
    data_since: z.string().nullable(),
    earned_at: z.string().nullable().openapi({ description: 'Cuándo la ganó; null = bloqueada' }),
  })
  .openapi('MedalProgress');
export const MedalProgressList = z
  .object({
    items: z.array(MedalProgress),
    hidden: z.boolean().openapi({ description: 'Quien mira no es el dueño de la ficha (ni el admin): no ve el progreso de las bloqueadas' }),
    stats_since: z.string().nullable().openapi({
      description: 'Desde cuándo cuentan las stats: el inicio de la temporada 2. null durante la BETA, que no da medallas',
    }),
  })
  .openapi('MedalProgressList');

/** Dar una medalla manual (Administración › Jugadores › Fichas). */
export const MedalGrant = z
  .object({
    definition_id: z.uuid().openapi({ description: 'Una definición manual (Comunidad: staff, caster, campeón de torneo…)' }),
    title: z.string().trim().min(1).max(80).optional().openapi({ description: 'Por defecto, el de la definición (por ejemplo, el nombre del torneo)' }),
  })
  .openapi('MedalGrant');
