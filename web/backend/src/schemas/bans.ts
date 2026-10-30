import { z } from '@hono/zod-openapi';
import { Envelope, listQuery } from '../lib/list';
import { STEAM64 } from './claim';

// Baneos de los servidores gestionados desde la web (plan docs/bitacora/2026-10-25-baneos-web, replanteo 31).

const reason = z.string().trim().min(1, 'El motivo es obligatorio').max(200, 'Hasta 200 caracteres');

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
  })
  .superRefine((v, ctx) => {
    if ((v.player_id === undefined) === (v.steam_id === undefined))
      ctx.addIssue({ code: 'custom', path: ['player_id'], message: 'Elegí una ficha (`player_id`) o un SteamID (`steam_id`), uno de los dos' });
    if ((v.expires_at === undefined) === (v.permanent === undefined))
      ctx.addIssue({ code: 'custom', path: ['expires_at'], message: 'Elegí un vencimiento (`expires_at`) o `permanent`, uno de los dos' });
  })
  .openapi('BanCreate');

export const BanPatch = z
  .object({
    reason: reason.optional(),
    expires_at: z.iso.datetime({ offset: true }).optional().openapi({ description: 'Nuevo vencimiento, futuro' }),
    permanent: z.literal(true).optional().openapi({ description: 'Sin vencimiento. Solo un admin' }),
  })
  .superRefine((v, ctx) => {
    if (v.reason === undefined && v.expires_at === undefined && v.permanent === undefined)
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'No hay nada que cambiar' });
    if (v.expires_at !== undefined && v.permanent !== undefined)
      ctx.addIssue({ code: 'custom', path: ['expires_at'], message: 'Elegí un vencimiento o `permanent`, no los dos' });
  })
  .openapi('BanPatch');

export const BanLift = z.object({ reason: reason.openapi({ description: 'Por qué se levanta' }) }).openapi('BanLift');
