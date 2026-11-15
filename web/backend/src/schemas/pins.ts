import { z } from '@hono/zod-openapi';

// Pines y trofeos de torneo, premios individuales y vitrina del jugador (replanteo 123).

export const PIN_TIERS = ['champion', 'finalist', 'third', 'semifinalist', 'quarter', 'round16', 'participant'] as const;
export const PIN_METALS = ['oro', 'plata', 'bronce', 'acero'] as const;
export const PIN_STYLES = [
  'clasico', 'cristal', 'escudo', 'moneda', 'estrella', 'globo', 'cinta', 'angular',
  'anillos', 'isotipo', 'rombo', 'jarron', 'orbe', 'alas', 'bloques', 'corona', 'disco', 'obelisco', 'estrella3d',
] as const;
export const PIN_AWARDS = ['mvp', 'top_fragger', 'awp', 'clutch', 'hs', 'adr', 'entry', 'play'] as const;

export const PinTier = z.enum(PIN_TIERS).openapi('PinTier', { description: 'Escalón por puesto final' });
export const PinMetal = z.enum(PIN_METALS).openapi('PinMetal');
export const PinStyle = z.enum(PIN_STYLES).openapi('PinStyle', { description: 'Familia de dibujo del torneo' });
export const PinAward = z.enum(PIN_AWARDS).openapi('PinAward', { description: 'Premio individual' });

const TierConfig = z
  .object({
    on: z.boolean().optional(),
    metal: PinMetal.optional(),
    min_teams: z.number().int().min(2).max(128).nullable().optional().openapi({ description: 'Equipos que jugaron, como mínimo, para dar este escalón' }),
  })
  .strict();
const AwardConfig = z
  .object({
    on: z.boolean().optional(),
    mode: z.enum(['auto', 'pick']).optional().openapi({ description: '`auto`: gana el de mejor cifra. `pick`: lo elige el organizador. La jugada es siempre `pick`' }),
  })
  .strict();

/** Lo que se guarda en `events.pins`: solo lo que cambia respecto de los valores por defecto. */
export const PinsConfigInput = z
  .object({
    enabled: z.boolean().optional(),
    style: PinStyle.optional(),
    tiers: z.partialRecord(PinTier, TierConfig).optional(),
    awards: z.partialRecord(PinAward, AwardConfig).optional(),
  })
  .strict()
  .openapi('PinsConfigInput', { description: 'Pines y premios del torneo. Lo que falta toma el valor por defecto. `null` vuelve todo al defecto' });

/** La configuración efectiva (con los valores por defecto completados). */
export const PinsConfig = z
  .object({
    enabled: z.boolean(),
    style: PinStyle,
    tiers: z.record(PinTier, z.object({ on: z.boolean(), metal: PinMetal, min_teams: z.number().int().nullable() })),
    awards: z.record(PinAward, z.object({ on: z.boolean(), mode: z.enum(['auto', 'pick']) })),
  })
  .openapi('PinsConfig');

const TeamRef = z.object({ id: z.uuid(), name: z.string(), tag: z.string().nullable(), logo_url: z.string().nullable() });
const EventRef = z.object({ id: z.uuid(), name: z.string() });

export const TeamPin = z
  .object({
    id: z.uuid(),
    event: EventRef,
    team: TeamRef,
    tier: PinTier,
    place: z.number().int().openapi({ description: 'Puesto final (los empatados comparten el número)' }),
    year: z.number().int(),
    style: PinStyle,
    metal: PinMetal,
    awarded_at: z.string(),
  })
  .openapi('TeamPin');

export const Award = z
  .object({
    id: z.uuid(),
    event: EventRef,
    award: PinAward,
    player: z.object({ id: z.uuid(), nick: z.string() }),
    team: TeamRef.nullable(),
    value: z.number().nullable().openapi({ description: 'La cifra con la que lo ganó (rating, kills, %, ADR…). null si se eligió sin stats' }),
    manual: z.boolean().openapi({ description: 'Lo eligió el organizador' }),
    clip_id: z.uuid().nullable().openapi({ description: 'Solo la jugada del torneo' }),
    year: z.number().int(),
    style: PinStyle,
    awarded_at: z.string(),
  })
  .openapi('Award');

export const EventPins = z
  .object({
    config: PinsConfig,
    custom: PinsConfigInput.nullable().openapi({ description: 'Lo que el torneo cambió (events.pins), para el formulario' }),
    results: z.array(TeamPin).openapi({ description: 'Los pines por puesto, del 1.º al último' }),
    awards: z.array(Award),
    pending: z.array(PinAward).openapi({ description: 'Premios encendidos que esperan que el organizador los elija' }),
    calculable: z.record(PinAward, z.boolean()).openapi({ description: 'Si el torneo tiene stats para calcular cada premio' }),
  })
  .openapi('EventPins');

export const AwardParam = z.object({
  id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }),
  award: PinAward.openapi({ param: { name: 'award', in: 'path' } }),
});

export const AwardCandidate = z
  .object({
    player: z.object({ id: z.uuid(), nick: z.string() }),
    team: TeamRef.nullable(),
    value: z.number().nullable(),
    kills: z.number().int().nullable(),
    adr: z.number().nullable(),
    rating: z.number().nullable(),
    maps: z.number().int().nullable(),
    suggested: z.boolean().openapi({ description: 'Entre los 10 mejores por la cifra del premio (los que llegan al mínimo)' }),
  })
  .openapi('AwardCandidate');
export const AwardCandidateList = z
  .object({ items: z.array(AwardCandidate).openapi({ description: 'Todo el plantel inscrito: primero los sugeridos, en orden' }) })
  .openapi('AwardCandidateList');

export const AwardPick = z
  .object({
    player_id: z.uuid().optional().openapi({ description: 'El ganador (todos los premios salvo la jugada)' }),
    clip_id: z.uuid().optional().openapi({ description: 'El clip (solo la jugada del torneo): el ganador es su jugador' }),
  })
  .refine((o) => !!o.player_id !== !!o.clip_id, { message: 'Elegí un jugador o un clip.' })
  .openapi('AwardPick');

export const ShowcaseItem = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pin'), pin: TeamPin.openapi({ description: 'En la vitrina del jugador, `id` es el de su pin (player_pins)' }) }),
  z.object({ kind: z.literal('award'), award: Award }),
]);

export const PlayerShowcase = z
  .object({
    mode: z.enum(['auto', 'manual']).openapi({ description: '`auto`: los destacados se eligen solos. `manual`: los marcó el jugador' }),
    featured: z.array(ShowcaseItem).openapi({ description: 'Los hasta 6 del Resumen, en orden' }),
    pins: z.array(TeamPin).openapi({ description: 'Todos sus pines, del más reciente al más viejo (`id` es el de su pin)' }),
    awards: z.array(Award).openapi({ description: 'Todos sus premios individuales' }),
  })
  .openapi('PlayerShowcase');

export const ShowcaseBody = z
  .object({
    mode: z.enum(['auto', 'manual']),
    items: z.array(z.object({ kind: z.enum(['pin', 'award']), id: z.uuid() })).max(6).default([]),
  })
  .openapi('ShowcaseBody');

export const TeamPinList = z.object({ items: z.array(TeamPin) }).openapi('TeamPinList');

export const EventClip = z
  .object({
    id: z.uuid(),
    match_id: z.uuid(),
    player: z.object({ id: z.uuid().nullable(), name: z.string() }),
    type: z.string().nullable().openapi({ description: 'ace, 4k, clutch…' }),
    round: z.number().int().nullable(),
    kills: z.number().int().nullable(),
    clutch_vs: z.number().int().nullable(),
  })
  .openapi('EventClip');
export const EventClipList = z.object({ items: z.array(EventClip) }).openapi('EventClipList');

const MedalKey = z.object({
  definition_id: z.uuid(),
  title: z.string().min(1).max(200),
  rank: z.number().int().nullable(),
});
export const FeaturedMedals = z
  .object({
    mode: z.enum(['auto', 'manual']).openapi({ description: '`auto`: los de más veces conseguidos. `manual`: los que marcó el jugador' }),
    items: z.array(MedalKey).openapi({ description: 'En `manual`, los elegidos en orden (definición, título y puesto, como en /medals/summary)' }),
  })
  .openapi('FeaturedMedals');
export const FeaturedMedalsBody = z
  .object({ mode: z.enum(['auto', 'manual']), items: z.array(MedalKey).max(10).default([]) })
  .openapi('FeaturedMedalsBody');
