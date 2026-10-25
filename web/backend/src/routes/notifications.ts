import { createRoute, type z } from '@hono/zod-openapi';
import { requireUser } from '../lib/auth';
import { must } from '../lib/db';
import { notModified } from '../lib/etag';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import { bearer, errorResponses, json } from '../schemas/common';
import { MarkRead, type Notification, NotificationList, NotificationQuery, UnreadCount } from '../schemas/notifications';

// Notificaciones de la web (replanteo 28, plan docs/bitacora/2026-10-25-notificaciones). Las crea la base; la API
// solo las lista, cuenta y marca. Aceptar o rechazar una invitación sigue en sus propios endpoints.

type Row = {
  id: number; type: string; category: z.infer<typeof Notification>['category']; data: Record<string, unknown> | null;
  actionable: boolean; resolution: z.infer<typeof Notification>['resolution']; created_at: string; read_at: string | null;
  actor_id: string | null; actor_alias: string | null;
};

export const toNotification = (r: Row): z.infer<typeof Notification> => ({
  id: Number(r.id),
  type: r.type,
  category: r.category,
  data: r.data ?? {},
  actionable: r.actionable,
  resolution: r.resolution,
  actor: r.actor_id ? { id: r.actor_id, alias: r.actor_alias } : null,
  created_at: r.created_at,
  read: r.read_at !== null,
});

const list = createRoute({
  method: 'get',
  path: '/api/v1/notifications',
  tags: ['Notificaciones'],
  summary: 'Mis notificaciones',
  description: 'Las últimas 100 de la cuenta, de la más nueva a la más vieja. Filtros `unread`, `actionable` y `category`.',
  security: bearer,
  middleware: [requireUser] as const,
  request: { query: NotificationQuery },
  responses: { 200: { description: 'Notificaciones', ...json(NotificationList) }, ...errorResponses(400, 401) },
});

const unreadCount = createRoute({
  method: 'get',
  path: '/api/v1/notifications/unread-count',
  tags: ['Notificaciones'],
  summary: 'Contador de la campana',
  description:
    'Sin leer y pendientes de responder. Responde con `ETag`: con `If-None-Match` contesta `304` si no cambió. ' +
    'La web lo consulta cada 30 segundos, al enfocar la pestaña y después de una acción.',
  security: bearer,
  middleware: [requireUser] as const,
  responses: { 200: { description: 'Contador', ...json(UnreadCount) }, 304: { description: 'Sin cambios' }, ...errorResponses(401) },
});

const markRead = createRoute({
  method: 'post',
  path: '/api/v1/notifications/read',
  tags: ['Notificaciones'],
  summary: 'Marcar como leídas',
  description: '`{ ids }` marca esas (las de otra cuenta se ignoran); `{ all: true }`, todas.',
  security: bearer,
  middleware: [requireUser] as const,
  request: { body: { required: true, ...json(MarkRead) } },
  responses: { 204: { description: 'Listo' }, ...errorResponses(400, 401) },
});

export const notifications = createRouter()
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb
      .from('notification_list')
      .select('id, type, category, data, actionable, resolution, created_at, read_at, actor_id, actor_alias', { count: 'exact' });
    if (p.unread !== undefined) q = p.unread ? q.is('read_at', null) : q.not('read_at', 'is', null);
    if (p.actionable !== undefined) q = p.actionable ? q.eq('actionable', true).is('resolution', null) : q.eq('actionable', false);
    if (p.category) q = q.eq('category', p.category);
    // created_at empata en las que nacen juntas: el id desempata en el mismo sentido.
    const { rows, total } = await runList<Row, typeof q>(q, p, { created_at: ['created_at', 'id'] }, null);
    return c.json(envelope(rows.map(toNotification), total, p), 200);
  })
  .openapi(unreadCount, async (c) => {
    const row = must(await c.var.sb.rpc('notifications_unread').single()) as { unread: number; actionable: number; last_id: number };
    const body = { unread: row.unread, actionable: row.actionable };
    // El ETag incluye la última: una nueva cambia la respuesta aunque el número sea el mismo.
    if (await notModified(c, { ...body, last: row.last_id })) return c.body(null, 304);
    return c.json(body, 200);
  })
  .openapi(markRead, async (c) => {
    const b = c.req.valid('json');
    must(await c.var.sb.rpc('notifications_mark_read', 'all' in b ? { p_all: true } : { p_ids: b.ids }));
    return c.body(null, 204);
  });
