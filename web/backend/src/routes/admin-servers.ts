import { createRoute } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave, notFound, searchTerm } from '../lib/db';
import { AppError } from '../lib/errors';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { IdParam } from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';
import { AdminServer, AdminServerList, AdminServerQuery, ServerCreate, ServerPatch, ServerToken } from '../schemas/servers';

// Admin de servidores de juego: alta, token, licencia, IP permitida, revocar, borrar, dirección e id del panel
// (plan docs/bitacora/2026-10-16-api-admin-servidores). Todo con el token del admin: manda la RLS.

type C = Context<AppEnv>;
const COLUMNS =
  'id, name, active, license_state, license_expires_at, allowed_ip, online, last_seen_at, last_ip, plugin_version, connect_address, panel_server_id, matches, last_match_at, created_at';

/** Nombre corto para `server/build_licenciado.sh`: minúsculas, sin tildes, letras, números y guiones. */
export function shortName(name: string): string {
  const s = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'servidor';
}

/** Token, líneas del cfg y comando del build licenciado. */
export function tokenResponse(c: C, id: string, name: string, token: string) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = c.var.config;
  return {
    id,
    token,
    cfg: [
      `csstv_api_url "${SUPABASE_URL}/rest/v1/rpc/ingest_server_chunk"`,
      `csstv_api_key "${SUPABASE_ANON_KEY}"`,
      `csstv_server_token "${token}"`,
    ].join('\n'),
    build_command: `server/build_licenciado.sh ${id} ${shortName(name)}`,
  };
}

/** El índice único de la base da un mensaje en inglés: se reemplaza por uno claro. */
function sameName<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof AppError && e.code === 'CONFLICT') throw new AppError(409, 'CONFLICT', 'Ya hay un servidor con ese nombre.');
    throw e;
  }
}

async function getServer(c: C, id: string) {
  const s = must(await c.var.sb.from('admin_server_list').select(COLUMNS).eq('id', id).maybeSingle());
  if (!s) throw notFound('ese servidor');
  return s;
}

const list = createRoute({
  method: 'get', path: '/api/v1/admin/servers', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Servidores de juego', description: 'Con estado de licencia, si está en línea, última IP, versión del plugin y partidas.',
  request: { query: AdminServerQuery },
  responses: { 200: { description: 'Servidores', ...json(AdminServerList) }, ...errorResponses(400, 401, 403) },
});
const detail = createRoute({
  method: 'get', path: '/api/v1/admin/servers/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Un servidor', request: { params: IdParam },
  responses: { 200: { description: 'Servidor', ...json(AdminServer) }, ...errorResponses(401, 403, 404) },
});
const create = createRoute({
  method: 'post', path: '/api/v1/admin/servers', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Crear un servidor',
  description: 'Devuelve el token (**se muestra una sola vez**), las líneas del cfg y el comando del build licenciado.',
  request: { body: { required: true, ...json(ServerCreate) } },
  responses: { 201: { description: 'Creado', ...json(ServerToken) }, ...errorResponses(400, 401, 403, 409) },
});
const patch = createRoute({
  method: 'patch', path: '/api/v1/admin/servers/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Editar un servidor',
  description: 'Nombre, dirección, id del panel, vencimiento, IP permitida, o revocar (`active: false`) y reactivar. Devuelve el servidor.',
  request: { params: IdParam, body: { required: true, ...json(ServerPatch) } },
  responses: { 200: { description: 'Servidor', ...json(AdminServer) }, ...errorResponses(400, 401, 403, 404, 409) },
});
const rotate = createRoute({
  method: 'post', path: '/api/v1/admin/servers/{id}/token', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Generar un token nuevo',
  description: 'El anterior deja de funcionar al instante y el servidor queda activo. El token nuevo se muestra una sola vez.',
  request: { params: IdParam },
  responses: { 200: { description: 'Token nuevo', ...json(ServerToken) }, ...errorResponses(401, 403, 404) },
});
const remove = createRoute({
  method: 'delete', path: '/api/v1/admin/servers/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Borrar un servidor', description: 'Solo sin partidas. Con partidas, `400`: hay que revocarlo.',
  request: { params: IdParam },
  responses: { 204: { description: 'Borrado' }, ...errorResponses(400, 401, 403, 404) },
});

export const adminServers = createRouter()
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('admin_server_list').select(COLUMNS, { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    if (p.active !== undefined) q = q.eq('active', p.active);
    if (p.license) q = q.eq('license_state', p.license);
    if (p.online !== undefined) q = q.eq('online', p.online);
    if (p.has_panel !== undefined) q = q.eq('has_panel', p.has_panel);
    type Row = Awaited<ReturnType<typeof getServer>>;
    const { rows, total } = await runList<Row, typeof q>(q, p, {});
    return c.json(envelope(rows.map(toServer), total, p), 200);
  })
  .openapi(detail, async (c) => c.json(toServer(await getServer(c, c.req.valid('param').id)), 200))
  .openapi(create, async (c) => {
    const b = c.req.valid('json');
    // El nombre repetido lo rechaza la base con su propio mensaje (409).
    const row = mustHave(
      await c.var.sb.rpc('admin_create_server', {
        p_name: b.name,
        p_connect_address: b.connect_address ?? undefined,
        p_panel_server_id: b.panel_server_id ?? undefined,
        p_license_expires_at: b.license_expires_at ?? undefined,
        p_allowed_ip: b.allowed_ip ?? undefined,
      }),
    )[0];
    if (!row) throw new AppError(500, 'INTERNAL', 'Supabase no devolvió el servidor.');
    return c.json(tokenResponse(c, row.id, b.name, row.token), 201);
  })
  .openapi(patch, async (c) => {
    const { id } = c.req.valid('param');
    const b = c.req.valid('json');
    const set = Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)) as typeof b;
    const res = await c.var.sb.from('game_servers').update(set).eq('id', id).select('id');
    const rows = sameName(() => must(res));
    if (!rows?.length) throw notFound('ese servidor');
    return c.json(toServer(await getServer(c, id)), 200);
  })
  .openapi(rotate, async (c) => {
    const { id } = c.req.valid('param');
    const s = await getServer(c, id);
    const token = mustHave(await c.var.sb.rpc('rotate_server_token', { p_server: id }));
    return c.json(tokenResponse(c, id, s.name ?? '', token), 200);
  })
  .openapi(remove, async (c) => {
    const rows = must(await c.var.sb.from('game_servers').delete().eq('id', c.req.valid('param').id).select('id'));
    if (!rows?.length) throw notFound('ese servidor');
    return c.body(null, 204);
  });

type ServerRow = Awaited<ReturnType<typeof getServer>>;
function toServer(s: ServerRow) {
  return {
    id: s.id!,
    name: s.name ?? '',
    active: s.active ?? false,
    license_state: (s.license_state ?? 'revoked') as 'ok' | 'expiring' | 'expired' | 'revoked',
    license_expires_at: s.license_expires_at ?? null,
    allowed_ip: s.allowed_ip ?? null,
    online: s.online ?? false,
    last_seen_at: s.last_seen_at ?? null,
    last_ip: s.last_ip ?? null,
    plugin_version: s.plugin_version ?? null,
    connect_address: s.connect_address ?? null,
    panel_server_id: s.panel_server_id ?? null,
    matches: s.matches ?? 0,
    last_match_at: s.last_match_at ?? null,
    created_at: s.created_at ?? '',
  };
}
