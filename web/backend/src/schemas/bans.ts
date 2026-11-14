import { z } from '@hono/zod-openapi';
import { Envelope, listQuery } from '../lib/list';
import { STEAM64 } from './claim';

// Baneos de los servidores gestionados desde la web (plan docs/bitacora/2026-10-25-baneos-web, replanteo 31).

const reason = z.string().trim().min(1, 'El motivo es obligatorio').max(200, 'Hasta 200 caracteres');

/** Lo más largo que banea el soporte (replanteo 117). */
export const SUPPORT_BAN_MAX_MINUTES = 120;
const supportMinutes = z.number().int().min(1, 'De 1 a 120 minutos').max(SUPPORT_BAN_MAX_MINUTES, 'De 1 a 120 minutos').openapi({
  description: 'Duración en minutos, desde ahora (de 1 a 120). Es como banea el soporte (replanteo 117), que no puede usar `expires_at` ni `permanent`',
});

export const Ban = z
  .object({
    id: z.uuid(),
    player: z.object({ id: z.uuid(), alias: z.string() }).nullable().openapi({
      description: 'Ficha alcanzada: la baneada o, si se baneó un SteamID sin ficha, la que lo tenga hoy. `null`: SteamID sin ficha',
    }),
    nick: z.string().nullable().openapi({ description: 'Alias de la ficha o último nick conocido del SteamID' }),
    steam_id: z.string().nullable().openapi({
      description: 'SteamID baneado. Sin ficha es público (como los perfiles sin reclamar); con ficha, solo para moderadores y admins',
    }),
    reason: z.string(),
    created_at: z.string(),
    expires_at: z.string().nullable().openapi({ description: '`null`: permanente' }),
    permanent: z.boolean(),
    status: z.enum(['active', 'expired', 'lifted']),
    source: z.enum(['web', 'server', 'import']).openapi({ description: '`web`, `server` (`!ban` del juego) o `import` (los `banned_user.cfg` viejos)' }),
    server: z.object({ id: z.uuid(), name: z.string() }).nullable().openapi({ description: 'Servidor donde se puso con `!ban`' }),
    created_by: z
      .object({ id: z.uuid().nullable(), alias: z.string().nullable() })
      .nullable()
      .openapi({ description: 'Cuenta de la web (`id`) o admin del juego (solo `alias`, el nombre que tenía)' }),
    lifted: z
      .object({
        at: z.string(),
        reason: z.string().nullable(),
        by: z.object({ id: z.uuid().nullable(), alias: z.string().nullable() }).nullable(),
        replaced_by: z.uuid().nullable().openapi({ description: 'Baneo nuevo que lo reemplazó' }),
      })
      .nullable()
      .openapi({ description: 'Si se levantó: cuándo, por qué y quién' }),
  })
  .openapi('Ban');

const filters = {
  status: z.enum(['active', 'expired', 'lifted']).optional().openapi({ description: 'Activos, vencidos o levantados' }),
  source: z.enum(['web', 'server', 'import']).optional(),
};

export const BanQuery = listQuery(['created_at', 'expires_at'], { sort: 'created_at', order: 'desc' }).extend({
  ...filters,
  q: z.string().max(60).optional().openapi({
    description: 'Busca en el nick y el motivo, y en el SteamID de los baneos sin ficha (moderadores y admins: en todos)',
  }),
  server: z.uuid().optional().openapi({ description: 'Solo los puestos en este servidor' }),
});
export const BanList = Envelope(Ban).openapi('BanList');

export const PlayerBanQuery = listQuery(['created_at', 'expires_at'], { sort: 'created_at', order: 'desc' }).extend(filters);

export const BanIdParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });

export const BanCreate = z
  .object({
    player_id: z.uuid().optional().openapi({ description: 'Ficha a banear (todos sus SteamID). Necesita SteamID' }),
    steam_id: z.string().regex(STEAM64, 'SteamID64 inválido').optional().openapi({
      description: 'SteamID64 sin ficha. Si tiene ficha, se banea la ficha',
    }),
    reason: reason.openapi({ description: 'Se muestra en la lista pública y al echarlo del servidor' }),
    expires_at: z.iso.datetime({ offset: true }).optional().openapi({ description: 'Vencimiento, futuro' }),
    permanent: z.literal(true).optional().openapi({ description: 'Sin vencimiento. Solo un admin' }),
    minutes: supportMinutes.optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.player_id === undefined) === (v.steam_id === undefined))
      ctx.addIssue({ code: 'custom', path: ['player_id'], message: 'Elegí una ficha (`player_id`) o un SteamID (`steam_id`), uno de los dos' });
    if ([v.expires_at, v.permanent, v.minutes].filter((x) => x !== undefined).length !== 1)
      ctx.addIssue({ code: 'custom', path: ['expires_at'], message: 'Elegí un vencimiento (`expires_at`), `minutes` o `permanent`, uno solo' });
  })
  .openapi('BanCreate');

export const BanPatch = z
  .object({
    reason: reason.optional(),
    expires_at: z.iso.datetime({ offset: true }).optional().openapi({ description: 'Nuevo vencimiento, futuro' }),
    permanent: z.literal(true).optional().openapi({ description: 'Sin vencimiento. Solo un admin' }),
    minutes: supportMinutes.optional().openapi({
      description: 'Nuevo vencimiento en minutos desde ahora (de 1 a 120). El del soporte no pasa de 120 minutos desde que se puso (replanteo 117)',
    }),
  })
  .superRefine((v, ctx) => {
    if (v.reason === undefined && v.expires_at === undefined && v.permanent === undefined && v.minutes === undefined)
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'No hay nada que cambiar' });
    if ([v.expires_at, v.permanent, v.minutes].filter((x) => x !== undefined).length > 1)
      ctx.addIssue({ code: 'custom', path: ['expires_at'], message: 'Elegí un vencimiento, `minutes` o `permanent`, uno solo' });
  })
  .openapi('BanPatch');

export const BanLift = z.object({ reason: reason.openapi({ description: 'Por qué se levanta' }) }).openapi('BanLift');

// ---------- Soporte (replanteo 117) ----------

export const SupportQuotaQuery = z
  .object({
    player_id: z.uuid().optional().openapi({ description: 'Ficha' }),
    steam_id: z.string().regex(STEAM64, 'SteamID64 inválido').optional().openapi({ description: 'SteamID64 sin ficha' }),
  })
  .superRefine((v, ctx) => {
    if ((v.player_id === undefined) === (v.steam_id === undefined))
      ctx.addIssue({ code: 'custom', path: ['player_id'], message: 'Elegí una ficha (`player_id`) o un SteamID (`steam_id`), uno de los dos' });
  });
export const SupportQuota = z
  .object({
    used: z.number().int().openapi({ description: 'Baneos de soporte en los últimos 7 días (los levantados también cuentan)' }),
    max: z.number().int(),
    remaining: z.number().int(),
    banned: z.boolean().openapi({ description: 'Si ya tiene un baneo activo (de quien sea): el soporte no lo puede banear' }),
    banned_until: z.string().nullable().openapi({ description: 'Hasta cuándo, si está baneado. `null` también si es permanente' }),
    permanent: z.boolean(),
  })
  .openapi('SupportQuota');

export const SUPPORT_ACTIONS = ['ban', 'ban_update', 'ban_lift', 'clip_reprocess', 'clip_approve', 'clip_reject', 'photo_remove', 'logo_remove',
  'comment_delete', 'comment_report', 'penalty_lift'] as const;
const Ref = z.object({ id: z.uuid(), alias: z.string() });
export const SupportAction = z
  .object({
    id: z.number().int(),
    action: z.enum(SUPPORT_ACTIONS),
    created_at: z.string(),
    actor: Ref.nullable().openapi({ description: 'La ficha de quien lo hizo (null si ya no tiene)' }),
    player: Ref.nullable().openapi({ description: 'El jugador alcanzado, si hay' }),
    team: z.object({ id: z.uuid(), name: z.string() }).nullable().openapi({ description: 'El equipo, en `logo_remove`' }),
    reason: z.string().nullable(),
    target: z.record(z.string(), z.unknown()).openapi({
      description: 'Detalle: `ban_id`, `expires_at`, `clip_id`, `match_id`, `comment_id`, `body` (el comentario), `decision`, las URL de la foto o el logo…',
    }),
  })
  .openapi('SupportAction');
export const SupportActionQuery = listQuery(['created_at'], { sort: 'created_at', order: 'desc' }).extend({
  actor: z.uuid().optional().openapi({ description: 'La cuenta de soporte (su id de usuario)' }),
  action: z.enum(SUPPORT_ACTIONS).optional(),
  from: z.iso.datetime({ offset: true }).optional().openapi({ description: 'Desde (incluido)' }),
  to: z.iso.datetime({ offset: true }).optional().openapi({ description: 'Hasta (sin incluir)' }),
});
export const SupportActionList = Envelope(SupportAction).openapi('SupportActionList');
