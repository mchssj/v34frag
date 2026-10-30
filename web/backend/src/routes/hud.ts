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
import { HudLink, ServerHudBody, Streamer, StreamerList, StreamerQuery } from '../schemas/hud';
import { AdminServer } from '../schemas/servers';
import { STREAMER_FIELDS, type StreamerRow, toStreamer } from '../services/hud';
import { userExists } from '../services/vip';
import { getServer, toServer } from './admin-servers';

// Relay del HUD en el VPS (plan docs/bitacora/2026-10-29-hud-relay-vps, replanteo 36): el HUD de cada servidor, la marca
// de streamer y el link de OBS. Las reglas (solo admins, puerto único, SourceTV para activarlo) las valida la base.

type C = Context<AppEnv>;

const setHud = createRoute({
  method: 'put', path: '/api/v1/admin/servers/{id}/hud', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'HUD de un servidor',
  description:
    'Puerto del relay (27500 a 27519, único) y si está activo. Al poner el puerto se genera la clave; `port: null` saca el HUD. ' +
    'Activarlo necesita la SourceTV del servidor (`connect_address` y `tv_port`): si falta, `BUSINESS_RULE`. Puerto usado por ' +
    'otro servidor: `409`. El relay lo toma en 30 segundos. Devuelve el servidor, con las líneas del cfg en `hud.cfg`.',
  request: { params: IdParam, body: { required: true, ...json(ServerHudBody) } },
  responses: { 200: { description: 'Servidor', ...json(AdminServer) }, ...errorResponses(400, 401, 403, 404, 409) },
});
const newKey = createRoute({
  method: 'post', path: '/api/v1/admin/servers/{id}/hud/key', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Clave nueva del HUD',
  description: 'Hay que copiarla al `csstv_hud.cfg` de ese servidor: hasta entonces el relay descarta sus paquetes. Sin puerto: `BUSINESS_RULE`.',
  request: { params: IdParam },
  responses: { 200: { description: 'Servidor', ...json(AdminServer) }, ...errorResponses(400, 401, 403, 404) },
});
const streamers = createRoute({
  method: 'get', path: '/api/v1/admin/streamers', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Streamers', description: 'Las cuentas con la marca de streamer, también las que la perdieron (`active=false`).',
  request: { query: StreamerQuery },
  responses: { 200: { description: 'Streamers', ...json(StreamerList) }, ...errorResponses(400, 401, 403) },
});
const grant = createRoute({
  method: 'post', path: '/api/v1/admin/users/{id}/streamer', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Dar la marca de streamer',
  description: 'Si ya la tiene, no cambia nada. Si se la habían quitado, vuelve sin link: tiene que generar uno. Avisa a la cuenta.',
  request: { params: IdParam },
  responses: { 200: { description: 'Streamer', ...json(Streamer) }, ...errorResponses(401, 403, 404) },
});
const revoke = createRoute({
  method: 'post', path: '/api/v1/admin/users/{id}/streamer/revoke', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Quitar la marca de streamer',
  description: 'Su link deja de andar en 30 segundos. Si no la tiene: `BUSINESS_RULE`. Avisa a la cuenta.',
  request: { params: IdParam },
  responses: { 200: { description: 'Streamer', ...json(Streamer) }, ...errorResponses(400, 401, 403, 404) },
});
const link = createRoute({
  method: 'post', path: '/api/v1/me/hud-link', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Generar mi link del HUD',
  description:
    'Solo streamers (`403` si no). Devuelve los links de OBS y del panel **una sola vez**: la base guarda el hash. Generar otro ' +
    'invalida el anterior en 30 segundos.',
  responses: { 200: { description: 'Links', ...json(HudLink) }, ...errorResponses(401, 403) },
});

async function existing(c: C, id: string) {
  if (!(await userExists(c.var.sb, id))) throw notFound('ese usuario');
  return id;
}

async function readStreamer(c: C, id: string) {
  const row = must(await c.var.sb.from('hud_streamer_list').select(STREAMER_FIELDS).eq('user_id', id).maybeSingle()) as StreamerRow | null;
  if (!row) throw notFound('esa marca de streamer');
  return toStreamer(row);
}

export const hud = createRouter()
  .openapi(setHud, async (c) => {
    const { id } = c.req.valid('param');
    await getServer(c, id);
    const b = c.req.valid('json');
    must(await c.var.sb.rpc('admin_set_server_hud', { p_server: id, p_port: b.port as number, p_enabled: b.enabled }));
    return c.json(toServer(c, await getServer(c, id)), 200);
  })
  .openapi(newKey, async (c) => {
    const { id } = c.req.valid('param');
    await getServer(c, id);
    must(await c.var.sb.rpc('admin_regenerate_hud_key', { p_server: id }));
    return c.json(toServer(c, await getServer(c, id)), 200);
  })
  .openapi(streamers, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('hud_streamer_list').select(STREAMER_FIELDS, { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.ilike('alias', `%${term}%`);
    if (p.active !== undefined) q = q.eq('active', p.active);
    const { rows, total } = await runList<StreamerRow, typeof q>(q, p, {}, 'user_id');
    return c.json(envelope(rows.map(toStreamer), total, p), 200);
  })
  .openapi(grant, async (c) => {
    const id = await existing(c, c.req.valid('param').id);
    must(await c.var.sb.rpc('admin_grant_streamer', { p_user: id }));
    return c.json(await readStreamer(c, id), 200);
  })
  .openapi(revoke, async (c) => {
    const id = await existing(c, c.req.valid('param').id);
    must(await c.var.sb.rpc('admin_revoke_streamer', { p_user: id }));
    return c.json(await readStreamer(c, id), 200);
  })
  .openapi(link, async (c) => {
    const base = c.var.config.HUD_BASE_URL;
    if (!base) throw new AppError(501, 'NOT_AVAILABLE', 'El HUD todavía no está configurado en el servidor.');
    const token = mustHave(await c.var.sb.rpc('hud_streamer_new_token'));
    return c.json({ hud_url: `${base}/s/${token}/hud`, control_url: `${base}/s/${token}/control`, created_at: new Date().toISOString() }, 200);
  });
