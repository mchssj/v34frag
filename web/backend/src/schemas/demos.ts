import { z } from '@hono/zod-openapi';
import { boolParam, dateParam, Envelope, listQuery } from '../lib/list';
import { confirmField } from './common';

// Demos desde el admin (plan docs/bitacora/2026-10-16-api-demos-admin).

export const DEMO_STATES = ['pending', 'uploaded', 'missing', 'expired'] as const;

export const DemoSummary = z
  .object({
    pending: z.number().int(),
    uploaded: z.number().int(),
    missing: z.number().int(),
    expired: z.number().int(),
    uploaded_bytes: z.number().int().openapi({ description: 'Lo que ocupan en R2 las demos subidas (sin las vencidas)' }),
    oldest_pending_at: z.string().nullable().openapi({ description: 'La pendiente más vieja (aviso si pasa de una hora)' }),
    worker_online: z.boolean().openapi({ description: 'Algún Worker activo usó su token en los últimos 25 minutos (corre cada 10)' }),
    worker_last_seen_at: z.string().nullable(),
  })
  .openapi('DemoSummary');

export const AdminDemo = z
  .object({
    match_id: z.uuid(),
    kind: z.string(),
    status: z.string().openapi({ description: 'Estado de la partida (`finished` o `cancelled`)' }),
    map: z.string().nullable(),
    played_at: z.string().nullable(),
    side1_name: z.string().nullable(),
    side2_name: z.string().nullable(),
    score1: z.number().int().nullable(),
    score2: z.number().int().nullable(),
    parent_match_id: z.uuid().nullable().openapi({ description: 'Partida de PCW o torneo de la que este mapa forma parte' }),
    server: z.object({ id: z.uuid(), name: z.string(), has_panel: z.boolean() }).nullable(),
    demo_status: z.enum(DEMO_STATES),
    demo_size: z.number().int().nullable().openapi({ description: 'Bytes' }),
    demo_attempts: z.number().int(),
    demo_uploaded_at: z.string().nullable(),
    expires_at: z.string().nullable().openapi({ description: 'Subida + 90 días (solo las subidas)' }),
    demo_url: z.string().nullable().openapi({ description: 'Descarga (solo las subidas)' }),
    can_retry: z.boolean().openapi({ description: '`missing` y con servidor con id del panel' }),
  })
  .openapi('AdminDemo');

export const AdminDemoQuery = listQuery(['played_at', 'demo_size', 'demo_attempts', 'demo_uploaded_at', 'expires_at'], {
  sort: 'played_at',
  order: 'desc',
}).extend({
  status: z.enum(DEMO_STATES).optional().openapi({ description: 'Estado de la demo' }),
  server: z.uuid().optional().openapi({ description: 'Id del servidor' }),
  kind: z.enum(['mix', 'pcw', 'official']).optional().openapi({ description: 'Tipo de partida' }),
  from: dateParam('Jugadas desde'),
  to: dateParam('Jugadas hasta'),
  q: z.string().max(60).optional().openapi({ description: 'Busca en los bandos, el mapa, el servidor y el id de la partida en el servidor' }),
});
export const AdminDemoList = Envelope(AdminDemo).openapi('AdminDemoList');

export const MatchIdParam = z.object({ matchId: z.uuid().openapi({ param: { name: 'matchId', in: 'path' } }) });

// ---------- Workers ----------

const Name = z.string().trim().min(2, 'Entre 2 y 40 caracteres').max(40, 'Entre 2 y 40 caracteres');

export const WorkerCreate = z.object({ name: Name.openapi({ description: 'Único, sin distinguir mayúsculas' }) }).openapi('DemoWorkerCreate');
export const WorkerPatch = z
  .object({
    name: Name.optional(),
    active: z.boolean().optional().openapi({ description: '`false` revoca (el Worker deja de poder subir demos), `true` reactiva' }),
  })
  .refine((o) => o.name !== undefined || o.active !== undefined, { message: 'No hay nada para actualizar.' })
  .openapi('DemoWorkerPatch');
export const WorkerRotate = z.object({ confirm: confirmField('generar un token nuevo') }).openapi('DemoWorkerRotate');

export const DemoWorker = z
  .object({
    id: z.uuid(),
    name: z.string(),
    active: z.boolean(),
    online: z.boolean().openapi({ description: 'Usó su token en los últimos 25 minutos' }),
    last_seen_at: z.string().nullable(),
    created_at: z.string(),
  })
  .openapi('DemoWorker');

export const WorkerToken = z
  .object({
    id: z.uuid(),
    token: z.string().openapi({ description: 'Se muestra una sola vez: la base guarda solo su hash' }),
    secret_command: z.string().openapi({ description: 'Cómo cargarlo en el Worker de Cloudflare' }),
  })
  .openapi('DemoWorkerToken');

export const WorkerQuery = listQuery(['name', 'created_at', 'last_seen_at'], { sort: 'name', order: 'asc' }).extend({
  q: z.string().max(60).optional(),
  active: boolParam('Activos o revocados'),
  online: boolParam('En línea'),
});
export const WorkerList = Envelope(DemoWorker).openapi('DemoWorkerList');
