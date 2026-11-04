import { z } from '@hono/zod-openapi';
import { boolParam, Envelope, listQuery } from '../lib/list';

// Notificaciones de la web (replanteo 28, plan docs/bitacora/2026-10-25-notificaciones).

export const NOTIFICATION_CATEGORIES = ['team', 'tournament', 'pcw', 'elo', 'season', 'account', 'news', 'admin'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Por defecto todas prendidas menos `news` (torneo nuevo y temporada nueva). */
export const NOTIFICATION_DEFAULTS: Record<NotificationCategory, boolean> = {
  team: true,
  tournament: true,
  pcw: true,
  elo: true,
  season: true,
  account: true,
  news: false,
  admin: true,
};

export const Notification = z
  .object({
    id: z.number().int(),
    type: z.string().openapi({ description: 'Tipo de evento (tabla en docs/frontend/contrato/notificaciones.md)', example: 'team_invite' }),
    category: z.enum(NOTIFICATION_CATEGORIES),
    data: z.record(z.string(), z.unknown()).openapi({ description: 'Ids y nombres del momento para armar el texto y el link' }),
    actionable: z.boolean().openapi({ description: 'Se acepta o rechaza desde la lista (invitación o pedido para entrar)' }),
    resolution: z
      .enum(['accepted', 'rejected', 'cancelled', 'expired'])
      .nullable()
      .openapi({ description: 'En una invitación o un pedido: cómo terminó. `null` mientras esté pendiente' }),
    actor: z
      .object({ id: z.uuid(), alias: z.string().nullable() })
      .nullable()
      .openapi({ description: 'Quién la provocó; `null` si fue el sistema (el servidor, el cron)' }),
    created_at: z.string(),
    read: z.boolean(),
  })
  .openapi('Notification');

export const NotificationQuery = listQuery(['created_at'], { sort: 'created_at', order: 'desc' }).extend({
  unread: boolParam('`true` solo las sin leer'),
  actionable: boolParam('`true` solo las de aceptar o rechazar que siguen pendientes'),
  category: z.enum(NOTIFICATION_CATEGORIES).optional().openapi({ description: 'Solo una categoría' }),
});
export const NotificationList = Envelope(Notification).openapi('NotificationList');

export const UnreadCount = z
  .object({
    unread: z.number().int().openapi({ description: 'Sin leer (el número de la campana)' }),
    actionable: z.number().int().openapi({ description: 'Invitaciones y pedidos pendientes de responder' }),
  })
  .openapi('UnreadCount');

export const MarkRead = z
  .union([
    z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) }).strict(),
    z.object({ all: z.literal(true) }).strict(),
  ])
  .openapi('MarkRead', { description: '`{ ids }` marca esas; `{ all: true }`, todas' });

export const NotificationPrefs = z
  .object(Object.fromEntries(NOTIFICATION_CATEGORIES.map((k) => [k, z.boolean()])) as Record<NotificationCategory, z.ZodBoolean>)
  .openapi('NotificationPrefs', {
    description:
      'Categorías prendidas (`true`) o apagadas. Por defecto todas prendidas menos `news`. La invitación a un equipo, el pedido ' +
      'para entrar a tu equipo y el cambio de contraseña llegan siempre.',
  });

export const NotificationPrefsPatch = z
  .object(
    Object.fromEntries(NOTIFICATION_CATEGORIES.map((k) => [k, z.boolean().optional()])) as Record<
      NotificationCategory,
      z.ZodOptional<z.ZodBoolean>
    >,
  )
  .strict()
  .openapi('NotificationPrefsPatch', { description: 'Solo se cambian las categorías enviadas' });

/** El mapa completo a partir de lo guardado (solo lo que el usuario cambió). */
export function notificationPrefsOf(prefs: unknown): z.infer<typeof NotificationPrefs> {
  const saved = (prefs as { notifications?: Record<string, unknown> } | null | undefined)?.notifications ?? {};
  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((k) => [k, typeof saved[k] === 'boolean' ? (saved[k] as boolean) : NOTIFICATION_DEFAULTS[k]]),
  ) as z.infer<typeof NotificationPrefs>;
}
