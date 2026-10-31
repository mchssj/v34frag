import { createRoute } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { optionalUser, requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave, notFound } from '../lib/db';
import { AppError } from '../lib/errors';
import { clientIp, rateLimit, RATE_RULES } from '../lib/ratelimit';
import { createRouter } from '../lib/router';
import { anonClient } from '../lib/supabase';
import type { AppEnv } from '../lib/types';
import { IdParam } from '../schemas/admin';
import {
  AdminSessionList,
  Approved,
  ApproveBody,
  ClaimBody,
  ClaimResult,
  DeviceList,
  Heartbeat,
  HeartbeatBody,
  LinkBody,
  LinkStart,
  OpenBody,
  OpenResult,
  PublicStatus,
  RefreshBody,
  SessionQuery,
  Tokens,
} from '../schemas/anticheat';
import { bearer, errorResponses, json } from '../schemas/common';
import { resolvePlayer } from '../services/players';

// Anticheat FRAG, etapa 1 (plan docs/bitacora/2026-10-30-anticheat-backend, replanteo 39). El agente entra con un código que
// el jugador aprueba en la web. La API le pasa a la base un secreto propio porque es quien informa la IP del agente:
// sin él, cualquiera con la anon key podría llamar a la función con una IP inventada.

type C = Context<AppEnv>;

const noSession = () => new AppError(401, 'UNAUTHORIZED', 'El token del agente no es válido o venció.');
const secret = (c: C) => {
  const s = c.var.config.AC_API_SECRET;
  if (!s) throw new AppError(501, 'NOT_AVAILABLE', 'El anticheat no está configurado en este servidor.');
  return s;
};
const agentToken = (c: C) => {
  const t = c.req.header('X-Agent-Token')?.trim();
  if (!t) throw noSession();
  return t;
};

// ---------- agente ----------

const link = createRoute({
  method: 'post', path: '/api/v1/anticheat/link', tags: ['Anticheat'], middleware: [rateLimit(RATE_RULES.acLink)] as const,
  summary: 'Empezar la vinculación del agente',
  description: 'Devuelve el código y la página que el agente abre en el navegador. Vale 10 minutos.',
  request: { body: { required: true, ...json(LinkBody) } },
  responses: { 201: { description: 'Código', ...json(LinkStart) }, ...errorResponses(400, 429) },
});
const claim = createRoute({
  method: 'post', path: '/api/v1/anticheat/link/claim', tags: ['Anticheat'], middleware: [rateLimit(RATE_RULES.acClaim)] as const,
  summary: 'Consultar si el jugador aprobó',
  description: '`pending`, `expired` o `approved`. Con `approved` llegan los tokens, **una sola vez**.',
  request: { body: { required: true, ...json(ClaimBody) } },
  responses: { 200: { description: 'Estado', ...json(ClaimResult) }, ...errorResponses(400, 429) },
});
const refresh = createRoute({
  method: 'post', path: '/api/v1/anticheat/token', tags: ['Anticheat'], middleware: [rateLimit(RATE_RULES.acClaim)] as const,
  summary: 'Renovar los tokens del agente',
  description: 'El token de renovación rota: el anterior deja de valer.',
  request: { body: { required: true, ...json(RefreshBody) } },
  responses: { 200: { description: 'Tokens', ...json(Tokens) }, ...errorResponses(400, 401, 429) },
});
const heartbeat = createRoute({
  method: 'post', path: '/api/v1/anticheat/heartbeat', tags: ['Anticheat'],
  summary: 'Latido del agente',
  description: 'Con el header `X-Agent-Token`. Registra la IP real de la conexión y devuelve la sesión abierta, si hay. **Sin sesión, el agente no recopila.**',
  request: { body: { required: false, ...json(HeartbeatBody) } },
  responses: { 200: { description: 'Estado', ...json(Heartbeat) }, ...errorResponses(400, 401) },
});

const unlink = createRoute({
  method: 'post', path: '/api/v1/anticheat/unlink', tags: ['Anticheat'],
  summary: 'Desvincular desde el agente',
  description: 'Con el header `X-Agent-Token`. El token deja de valer y se cierra la sesión.',
  responses: { 204: { description: 'Hecho' }, ...errorResponses(401) },
});

// ---------- jugador ----------

const approve = createRoute({
  method: 'post', path: '/api/v1/me/anticheat/approve', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Aprobar un agente',
  description: 'Vincula el equipo a mi cuenta. Hace falta tener el SteamID en la ficha: si no, `BUSINESS_RULE`.',
  request: { body: { required: true, ...json(ApproveBody) } },
  responses: { 200: { description: 'Aprobado', ...json(Approved) }, ...errorResponses(400, 401) },
});
const devices = createRoute({
  method: 'get', path: '/api/v1/me/anticheat/devices', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Mis equipos con agente',
  responses: { 200: { description: 'Equipos', ...json(DeviceList) }, ...errorResponses(401) },
});
const revoke = createRoute({
  method: 'delete', path: '/api/v1/me/anticheat/devices/{id}', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Desvincular un equipo',
  description: 'Sus tokens dejan de valer y se cierra su sesión.',
  request: { params: IdParam },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 404) },
});

// ---------- público ----------

const publicStatus = createRoute({
  method: 'get', path: '/api/v1/players/{id}/anticheat', tags: ['Jugadores'], middleware: [optionalUser] as const,
  summary: 'Estado del anticheat de un jugador',
  description: 'Solo hechos: si tiene agente vinculado y sus sesiones. No es un veredicto. `{id}` acepta el id o el nick.',
  request: { params: IdParam.extend({ id: IdParam.shape.id.or(ApproveBody.shape.user_code) }) },
  responses: { 200: { description: 'Estado', ...json(PublicStatus) }, ...errorResponses(400, 401, 404) },
});

// ---------- admin ----------

const sessions = createRoute({
  method: 'get', path: '/api/v1/admin/anticheat/sessions', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Sesiones del anticheat',
  description: 'Cada consulta queda registrada en `ac_admin_actions`.',
  request: { query: SessionQuery },
  responses: { 200: { description: 'Sesiones', ...json(AdminSessionList) }, ...errorResponses(400, 401, 403) },
});
const open = createRoute({
  method: 'post', path: '/api/v1/admin/anticheat/open', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Abrir los mixes sin agente',
  description: 'Para cuando el servicio tiene problemas: durante esos minutos no se expulsa a nadie. `minutes: 0` los vuelve a cerrar. Queda registrado.',
  request: { body: { required: true, ...json(OpenBody) } },
  responses: { 200: { description: 'Abierto', ...json(OpenResult) }, ...errorResponses(400, 401, 403) },
});

export const anticheat = createRouter();

anticheat.openapi(link, async (c) => {
  const b = c.req.valid('json');
  const sb = anonClient(c.var.config);
  const r = mustHave(await sb.rpc('ac_link_start', { p_secret: secret(c), p_device_name: b.device_name, p_version: b.agent_version ?? '' })) as {
    device_code: string; user_code: string; expires_in: number;
  };
  const verification_url = `${c.var.config.FRONTEND_URL.replace(/\/+$/, '')}/anticheat/vincular?code=${r.user_code}`;
  return c.json({ ...r, verification_url, interval: 5 }, 201);
});

anticheat.openapi(claim, async (c) => {
  const sb = anonClient(c.var.config);
  const r = mustHave(await sb.rpc('ac_link_claim', { p_secret: secret(c), p_device_code: c.req.valid('json').device_code }));
  return c.json(r as { status: 'pending' | 'approved' | 'expired' }, 200);
});

anticheat.openapi(refresh, async (c) => {
  const sb = anonClient(c.var.config);
  const r = must(await sb.rpc('ac_token_refresh', { p_secret: secret(c), p_refresh: c.req.valid('json').refresh_token }));
  if (!r) throw noSession();
  return c.json(r as { access_token: string; refresh_token: string; expires_in: number }, 200);
});

anticheat.openapi(heartbeat, async (c) => {
  const sb = anonClient(c.var.config);
  const version = c.req.valid('json')?.agent_version ?? '';
  const r = must(await sb.rpc('ac_heartbeat', { p_secret: secret(c), p_access: agentToken(c), p_ip: clientIp(c), p_version: version }));
  if (!r) throw noSession();
  return c.json(r as { session: null }, 200);
});

anticheat.openapi(unlink, async (c) => {
  const sb = anonClient(c.var.config);
  if (!must(await sb.rpc('ac_agent_unlink', { p_secret: secret(c), p_access: agentToken(c) }))) throw noSession();
  return c.body(null, 204);
});

anticheat.openapi(approve, async (c) => {
  const r = mustHave(await c.var.sb.rpc('ac_link_approve', { p_user_code: c.req.valid('json').user_code }));
  return c.json(r as { device_name: string }, 200);
});

anticheat.openapi(devices, async (c) => {
  const items = mustHave(
    await c.var.sb
      .from('ac_devices')
      .select('id, name, agent_version, last_seen_at, revoked_at, created_at')
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
  );
  return c.json({ items }, 200);
});

anticheat.openapi(revoke, async (c) => {
  const id = c.req.valid('param').id;
  // La RLS solo deja ver los propios: uno ajeno es un 404, sin revelar que existe.
  if (!must(await c.var.sb.from('ac_devices').select('id').eq('id', id).maybeSingle())) throw notFound('ese equipo');
  must(await c.var.sb.rpc('ac_device_revoke', { p_device: id }));
  return c.body(null, 204);
});

anticheat.openapi(publicStatus, async (c) => {
  const id = await resolvePlayer(c.var.sb, c.req.valid('param').id);
  const r = mustHave(await c.var.sb.rpc('ac_public_status', { p_player: id }));
  return c.json(r as { agent_linked: boolean; sessions_30d: number; last_session_at: string | null }, 200);
});

anticheat.openapi(sessions, async (c) => {
  const q = c.req.valid('query');
  const params = { p_limit: q.limit, p_offset: q.offset, ...(q.status ? { p_status: q.status } : {}) };
  const items = mustHave(await c.var.sb.rpc('ac_admin_sessions', params));
  return c.json({ items: items as never[] }, 200);
});

anticheat.openapi(open, async (c) => {
  const open_until = must(await c.var.sb.rpc('ac_set_open', { p_minutes: c.req.valid('json').minutes }));
  return c.json({ open_until: open_until ?? null }, 200);
});
