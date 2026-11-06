import { z } from '@hono/zod-openapi';
import { Envelope, listQuery } from '../lib/list';

// Clips automáticos: las jugadas destacadas de cada partida (plan docs/bitacora/2026-10-22-clips-automaticos).
// La base clasifica, ordena y aplica los topes (vista match_clip_list); los rangos son los de clip_set_config.

export const CLIP_TYPES = ['ace', 'clutch_5', 'clutch_4', '4k', 'clutch_3', '3k', 'clutch_2', 'clutch_1'] as const;

export const ClipListQuery = listQuery(['position', 'round'], { sort: 'position', order: 'asc' }, 50).extend({
  player: z.uuid().optional().openapi({ description: 'Solo los clips de esta ficha' }),
  type: z.enum(CLIP_TYPES).optional().openapi({ description: 'Solo los de este tipo' }),
});

export const CLIP_VIDEO_STATUS = ['pending', 'processing', 'done', 'failed', 'skipped', 'unavailable'] as const;

export const ClipVideo = z
  .object({
    status: z.enum(CLIP_VIDEO_STATUS).openapi({
      description:
        '`pending` (en cola), `processing` (grabándose), `done` (listo), `failed` (falló tres veces), `skipped` (no se puede grabar) ' +
        'o `unavailable` (la partida no tiene demo: nunca va a tener video)',
    }),
    url: z.string().nullable().openapi({ description: 'El `.mp4` (con Range) mientras está en R2: los primeros 15 días. `null` si no' }),
    embed_url: z.string().nullable().openapi({
      description: 'El reproductor de Google Drive (`iframe`), para siempre. Usar `url` si viene y, si no, este. `null` si no está en Drive',
    }),
    seconds: z.number().nullable().openapi({ description: 'Duración del video. `null` sin video' }),
  })
  .openapi('ClipVideo');

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
    video: ClipVideo,
    vip: z.boolean().openapi({ description: 'Entró por ser de un VIP (cuando se jugó el mix): va después del top' }),
    review: z.enum(['pending', 'approved', 'rejected']).nullable().openapi({
      description:
        'Solo para admins (`null` para los demás): `pending` si se reprocesó y espera el "Bien" (a los demás se les muestra sin video), ' +
        '`approved` si se aprobó, `rejected` si un admin lo rechazó (replanteo 76; solo en Administración), `null` si nunca se reprocesó',
    }),
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
    vip_per_match: int(0, 10, 'Clips de cada VIP en cada partida, aparte del top (0 los apaga)'),
    featured_max: int(1, 50, 'Clips destacados en la ficha de un jugador (replanteo 76)'),
    featured_max_vip: int(1, 50, 'Clips destacados en la ficha de un VIP (replanteo 76)'),
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
    vip_per_match: ClipConfigValues.shape.vip_per_match.optional(),
    featured_max: ClipConfigValues.shape.featured_max.optional(),
    featured_max_vip: ClipConfigValues.shape.featured_max_vip.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Mandá al menos un valor')
  .openapi('ClipConfigPatch', { description: 'Solo lo que cambia. Se aplica al listado de todas las partidas al instante: los datos no se tocan' });

// Reprocesar un clip (plan docs/bitacora/2026-10-28-clips-vip-y-reprocesar).
export const ClipParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });

export const ClipReview = z
  .object({
    clip: Clip,
    match: z.object({ id: z.uuid(), map: z.string().nullable(), played_at: z.string().nullable() }),
    reprocess_count: z.number().int().openapi({ description: 'Cuántas veces se reprocesó' }),
    reprocessed_at: z.string().openapi({ description: 'La última vez que se reprocesó' }),
  })
  .openapi('ClipReview');
export const ClipReviewList = Envelope(ClipReview).openapi('ClipReviewList');
export const ClipReviewQuery = listQuery(['reprocessed_at'], { sort: 'reprocessed_at', order: 'asc' });

// Lista de clips para reprocesar varios a la vez (plan docs/bitacora/2026-11-03-reportes-clips-nombre-equipo).
export const ADMIN_CLIP_STATUS = ['done', 'failed', 'processing', 'queued', 'no_demo', 'rejected'] as const;
export const AdminClipQuery = listQuery(['created_at'], { sort: 'created_at', order: 'desc' }).extend({
  status: z.enum(ADMIN_CLIP_STATUS).optional().openapi({
    description:
      '`done` con video, `failed` falló la grabación, `processing` grabándose, `queued` en la cola (sin video y con demo), `no_demo` sin video ni demo, ' +
      '`rejected` los rechazados (replanteo 76; los demás filtros no los muestran)',
  }),
  type: z.enum(CLIP_TYPES).optional(),
  q: z.string().trim().max(60).optional().openapi({ description: 'Nick del jugador en el juego' }),
});
export const AdminClip = z
  .object({
    clip: Clip,
    match: z.object({ id: z.uuid(), map: z.string().nullable(), played_at: z.string().nullable() }),
    reprocess_count: z.number().int().openapi({ description: 'Cuántas veces se reprocesó' }),
    discord_posted: z.boolean().openapi({ description: 'Si ya salió en Discord' }),
    can_reprocess: z.boolean(),
    blocked_reason: z.string().nullable().openapi({ description: 'Por qué no se puede reprocesar (null si se puede)' }),
    rejected: z
      .object({
        at: z.string(),
        by: z.object({ id: z.uuid(), alias: z.string().nullable() }).nullable(),
        reason: z.string().nullable(),
        can_restore: z.boolean().openapi({ description: 'Si se puede recuperar: con la demo todavía guardada' }),
      })
      .nullable()
      .openapi({ description: 'Quién lo rechazó, cuándo y por qué (replanteo 76). `null` si no está rechazado' }),
  })
  .openapi('AdminClip');
export const AdminClipList = Envelope(AdminClip).openapi('AdminClipList');
export const ClipReprocessBody = z
  .object({ ids: z.array(z.uuid()).min(1).max(50).openapi({ description: 'De 1 a 50 clips' }) })
  .openapi('ClipReprocessBody');
export const ClipReprocessResult = z
  .object({
    results: z.array(
      z.object({ id: z.uuid(), ok: z.boolean(), error: z.string().nullable().openapi({ description: 'El motivo, si no se pudo' }) }),
    ),
  })
  .openapi('ClipReprocessResult');

// Rechazar y recuperar un clip (replanteo 76, plan docs/bitacora/2026-11-04-clips-destacados-perfil).
export const ClipRejectBody = z
  .object({ reason: z.string().trim().max(300).optional().openapi({ description: 'Motivo, opcional: queda en la lista de rechazados' }) })
  .openapi('ClipRejectBody');
export const ClipRejectManyBody = ClipReprocessBody.extend({ reason: ClipRejectBody.shape.reason }).openapi('ClipRejectManyBody');

// Clips destacados en el perfil (replanteo 76).
export const FeaturedClip = z
  .object({
    clip: Clip,
    match: z.object({ id: z.uuid(), map: z.string().nullable(), played_at: z.string().nullable() }),
  })
  .openapi('FeaturedClip');
export const FEATURED_MODES = ['auto', 'manual'] as const;
export const MyClips = z
  .object({
    mode: z.enum(FEATURED_MODES).openapi({ description: '`auto`: se muestran solos los mejores; `manual`: los que elegí' }),
    vip: z.boolean(),
    max: z.number().int().openapi({ description: 'Cuántos se ven en mi ficha (el tope de VIP si lo soy)' }),
    max_vip: z.number().int().openapi({ description: 'El tope con VIP, para el aviso' }),
    picked: z.array(z.uuid()).openapi({ description: 'Los que elegí, en orden (se guardan aunque esté en automático)' }),
    shown: z.array(z.uuid()).openapi({ description: 'Los que se ven hoy en mi ficha, en orden' }),
    clips: z.array(FeaturedClip).openapi({ description: 'Mis clips con video, del más nuevo al más viejo' }),
  })
  .openapi('MyClips');
export const MyClipsPut = z
  .object({
    mode: z.enum(FEATURED_MODES),
    ids: z.array(z.uuid()).max(50).openapi({ description: 'Los elegidos, en orden (en `auto` se guardan para cuando vuelva a `manual`)' }),
  })
  .openapi('MyClipsPut');
export const FeaturedClipList = z.object({ items: z.array(FeaturedClip) }).openapi('FeaturedClipList');
