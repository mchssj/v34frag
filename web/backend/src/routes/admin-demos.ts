import { createRoute } from '@hono/zod-openapi';
import { requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave, notFound, searchTerm } from '../lib/db';
import { AppError } from '../lib/errors';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import { IdParam } from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  AdminDemoList,
  AdminDemoQuery,
  DemoSummary,
  DemoWorker,
  MatchIdParam,
  WorkerCreate,
  WorkerList,
  WorkerPatch,
  WorkerQuery,
  WorkerRotate,
  WorkerToken,
} from '../schemas/demos';
import { demoUrl } from '../services/matches';

// Demos desde el admin: resumen, listado, reintentar una perdida y tokens del Worker de demos
// (plan docs/bitacora/2026-10-16-api-demos-admin). Todo con el token del admin.

const DEMO_COLUMNS =
  'id, kind, status, map, played_at, external_id, parent_match_id, side1_name, side2_name, score1, score2, server_id, server_name, server_has_panel, ' +
  'demo_status, demo_size, demo_attempts, demo_uploaded_at, expires_at';
const WORKER_COLUMNS = 'id, name, active, online, last_seen_at, created_at';

/** Cómo cargar el token nuevo en el Worker de Cloudflare. */
export const SECRET_COMMAND =
  'En cloudflare/demo-worker: pnpm exec wrangler secret put DEMO_WORKER_TOKEN (pega el token cuando lo pida). Hasta entonces el Worker no sube demos.';

/** El índice único da un mensaje en inglés al editar: se reemplaza por uno claro. */
function sameName(e: unknown): never {
  if (e instanceof AppError && e.code === 'CONFLICT') throw new AppError(409, 'CONFLICT', 'Ya hay un Worker con ese nombre.');
  throw e;
}

const done = { 204: { description: 'Hecho' } } as const;

const summary = createRoute({
  method: 'get', path: '/api/v1/admin/demos/summary', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Resumen de las demos', description: 'Cantidad por estado, espacio en R2, la pendiente más vieja y si el Worker está en línea.',
  responses: { 200: { description: 'Resumen', ...json(DemoSummary) }, ...errorResponses(401, 403) },
});
const list = createRoute({
  method: 'get', path: '/api/v1/admin/demos', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Demos', description: 'Partidas con demo (no `none`), con estado, tamaño, intentos, vencimiento, servidor y link de descarga.',
  request: { query: AdminDemoQuery },
  responses: { 200: { description: 'Demos', ...json(AdminDemoList) }, ...errorResponses(400, 401, 403) },
});
const retry = createRoute({
  method: 'post', path: '/api/v1/admin/demos/{matchId}/retry', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Reintentar una demo perdida',
  description: 'Una demo `missing` vuelve a la cola del Worker con los intentos en 0. `400` con el motivo si no se puede.',
  request: { params: MatchIdParam },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});
const workers = createRoute({
  method: 'get', path: '/api/v1/admin/demo-workers', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Workers de demos', request: { query: WorkerQuery },
  responses: { 200: { description: 'Workers', ...json(WorkerList) }, ...errorResponses(400, 401, 403) },
});
const createWorker = createRoute({
  method: 'post', path: '/api/v1/admin/demo-workers', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Crear un Worker de demos', description: 'Devuelve el token (**se muestra una sola vez**) y cómo cargarlo en Cloudflare.',
  request: { body: { required: true, ...json(WorkerCreate) } },
  responses: { 201: { description: 'Creado', ...json(WorkerToken) }, ...errorResponses(400, 401, 403, 409) },
});
const patchWorker = createRoute({
  method: 'patch', path: '/api/v1/admin/demo-workers/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Editar un Worker de demos', description: 'Nombre, o revocar (`active: false`) y reactivar. Devuelve el Worker.',
  request: { params: IdParam, body: { required: true, ...json(WorkerPatch) } },
  responses: { 200: { description: 'Worker', ...json(DemoWorker) }, ...errorResponses(400, 401, 403, 404, 409) },
});
const rotateWorker = createRoute({
  method: 'post', path: '/api/v1/admin/demo-workers/{id}/token', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Token nuevo para un Worker',
  description:
    'El anterior deja de funcionar al instante: el Worker no sube demos hasta que se carga el nuevo en Cloudflare. ' +
    'Pide `confirm: "estoy seguro"` (doble confirmación en el frontend).',
  request: { params: IdParam, body: { required: true, ...json(WorkerRotate) } },
  responses: { 200: { description: 'Token nuevo', ...json(WorkerToken) }, ...errorResponses(400, 401, 403, 404) },
});
const deleteWorker = createRoute({
  method: 'delete', path: '/api/v1/admin/demo-workers/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Borrar un Worker de demos', request: { params: IdParam },
  responses: { ...done, ...errorResponses(401, 403, 404) },
});

type DemoRow = {
  id: string; kind: string; status: string; map: string | null; played_at: string | null; external_id: string | null;
  parent_match_id: string | null; side1_name: string | null; side2_name: string | null; score1: number | null; score2: number | null;
  server_id: string | null; server_name: string | null; server_has_panel: boolean | null; demo_status: string; demo_size: number | null;
  demo_attempts: number | null; demo_uploaded_at: string | null; expires_at: string | null;
};
type WorkerRow = { id: string; name: string; active: boolean; online: boolean; last_seen_at: string | null; created_at: string };

type Nullable<T> = { [K in keyof T]?: T[K] | null };
const toWorker = (w: Nullable<WorkerRow>) => ({
  id: w.id ?? '',
  name: w.name ?? '',
  active: w.active ?? false,
  online: w.online ?? false,
  last_seen_at: w.last_seen_at ?? null,
  created_at: w.created_at ?? '',
});

export const adminDemos = createRouter()
  .openapi(summary, async (c) => {
    const s = must(await c.var.sb.from('admin_demo_summary').select('*').maybeSingle());
    return c.json(
      {
        pending: s?.pending ?? 0,
        uploaded: s?.uploaded ?? 0,
        missing: s?.missing ?? 0,
        expired: s?.expired ?? 0,
        uploaded_bytes: Number(s?.uploaded_bytes ?? 0),
        oldest_pending_at: s?.oldest_pending_at ?? null,
        worker_online: s?.worker_online ?? false,
        worker_last_seen_at: s?.worker_last_seen_at ?? null,
      },
      200,
    );
  })
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('admin_demo_list').select(DEMO_COLUMNS, { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    if (p.status) q = q.eq('demo_status', p.status);
    if (p.server) q = q.eq('server_id', p.server);
    if (p.kind) q = q.eq('kind', p.kind);
    if (p.from) q = q.gte('played_at', p.from);
    if (p.to) q = q.lte('played_at', p.to);
    const { rows, total } = await runList<DemoRow, typeof q>(q, p, {});
    const cfg = c.var.config;
    return c.json(
      envelope(
        rows.map((m) => ({
          match_id: m.id,
          kind: m.kind,
          status: m.status,
          map: m.map,
          played_at: m.played_at,
          side1_name: m.side1_name,
          side2_name: m.side2_name,
          score1: m.score1,
          score2: m.score2,
          parent_match_id: m.parent_match_id,
          server: m.server_id ? { id: m.server_id, name: m.server_name ?? '', has_panel: m.server_has_panel ?? false } : null,
          demo_status: m.demo_status as 'pending' | 'uploaded' | 'missing' | 'expired',
          demo_size: m.demo_size,
          demo_attempts: m.demo_attempts ?? 0,
          demo_uploaded_at: m.demo_uploaded_at,
          expires_at: m.expires_at,
          demo_url: demoUrl(cfg, m),
          can_retry: m.demo_status === 'missing' && !!m.server_has_panel,
        })),
        total,
        p,
      ),
      200,
    );
  })
  .openapi(retry, async (c) => {
    must(await c.var.sb.rpc('admin_demo_retry', { p_match: c.req.valid('param').matchId }));
    return c.body(null, 204);
  })
  .openapi(workers, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('admin_demo_worker_list').select(WORKER_COLUMNS, { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    if (p.active !== undefined) q = q.eq('active', p.active);
    if (p.online !== undefined) q = q.eq('online', p.online);
    const { rows, total } = await runList<WorkerRow, typeof q>(q, p, {});
    return c.json(envelope(rows.map(toWorker), total, p), 200);
  })
  .openapi(createWorker, async (c) => {
    const row = mustHave(await c.var.sb.rpc('admin_create_demo_worker', { p_name: c.req.valid('json').name }))[0];
    if (!row) throw new AppError(500, 'INTERNAL', 'Supabase no devolvió el Worker.');
    return c.json({ id: row.id, token: row.token, secret_command: SECRET_COMMAND }, 201);
  })
  .openapi(patchWorker, async (c) => {
    const { id } = c.req.valid('param');
    const b = c.req.valid('json');
    const set = Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)) as typeof b;
    let rows: { id: string }[] | null;
    try {
      rows = must(await c.var.sb.from('demo_workers').update(set).eq('id', id).select('id'));
    } catch (e) {
      sameName(e);
    }
    if (!rows?.length) throw notFound('ese Worker');
    const w = must(await c.var.sb.from('admin_demo_worker_list').select(WORKER_COLUMNS).eq('id', id).maybeSingle());
    return c.json(toWorker(w ?? { id }), 200);
  })
  .openapi(rotateWorker, async (c) => {
    const { id } = c.req.valid('param');
    const exists = must(await c.var.sb.from('demo_workers').select('id').eq('id', id).maybeSingle());
    if (!exists) throw notFound('ese Worker');
    const token = mustHave(await c.var.sb.rpc('rotate_demo_worker_token', { p_worker: id }));
    return c.json({ id, token, secret_command: SECRET_COMMAND }, 200);
  })
  .openapi(deleteWorker, async (c) => {
    const rows = must(await c.var.sb.from('demo_workers').delete().eq('id', c.req.valid('param').id).select('id'));
    if (!rows?.length) throw notFound('ese Worker');
    return c.body(null, 204);
  });
