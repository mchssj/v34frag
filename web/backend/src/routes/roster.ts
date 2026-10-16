import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { isAdmin, requireUser } from '../lib/auth';
import { AppError } from '../lib/errors';
import { must, mustHave, notFound } from '../lib/db';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  CaptainBody,
  Created,
  InviteBody,
  MyInvites,
  TeamParam,
  TeamPending,
  TeamPlayerParam,
  type Invite,
} from '../schemas/teams';

type C = Context<AppEnv>;

const INVITE = 'id, kind, status, created_at, expires_at, team:teams(id, name, tag), player:players(id, nick, photo_url)';
type InviteRow = {
  id: string; kind: string; status: string; created_at: string; expires_at: string;
  team: { id: string; name: string; tag: string | null } | null;
  player: { id: string; nick: string; photo_url: string | null } | null;
};
const toInvite = (r: InviteRow): z.infer<typeof Invite> => ({
  id: r.id,
  kind: r.kind === 'request' ? 'request' : 'invite',
  status: r.status,
  team: r.team ?? { id: '', name: '', tag: null },
  player: { id: r.player?.id ?? '', alias: r.player?.nick ?? '', photo_url: r.player?.photo_url ?? null },
  created_at: r.created_at,
  expires_at: r.expires_at,
});

/** Abiertas y sin vencer (una vencida queda "open" hasta que la base la marca en la próxima acción). */
const openOnly = <Q extends { eq: (c: 'status', v: string) => Q; gt: (c: 'expires_at', v: string) => Q }>(q: Q) =>
  q.eq('status', 'open').gt('expires_at', new Date().toISOString());

const IdParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });
const ok = { 204: { description: 'Hecho' } } as const;

/** La invitación (visible por RLS) tiene que ser del tipo de la ruta. */
async function inviteOfKind(c: C, id: string, kind: 'invite' | 'request') {
  const row = must(await c.var.sb.from('team_invites').select('kind').eq('id', id).maybeSingle());
  if (!row || row.kind !== kind) throw notFound(kind === 'invite' ? 'esa invitación' : 'ese pedido');
}

// ---------- rutas del jugador ----------

const myInvites = createRoute({
  method: 'get', path: '/api/v1/me/team-invites', tags: ['Plantel'], security: bearer, middleware: [requireUser] as const,
  summary: 'Mis invitaciones y pedidos',
  description: 'Invitaciones de equipos que recibí y pedidos para entrar que hice, abiertos.',
  responses: { 200: { description: 'Abiertas', ...json(MyInvites) }, ...errorResponses(401) },
});
const joinRequest = createRoute({
  method: 'post', path: '/api/v1/teams/{id}/join-requests', tags: ['Plantel'], security: bearer, middleware: [requireUser] as const,
  summary: 'Pedir entrar a un equipo',
  description: 'Hace falta tener el SteamID vinculado. El capitán acepta o rechaza; vence a los 7 días.',
  request: { params: TeamParam },
  responses: { 201: { description: 'Pedido creado', ...json(Created) }, ...errorResponses(400, 401) },
});
const acceptInvite = createRoute({
  method: 'post', path: '/api/v1/team-invites/{id}/accept', tags: ['Plantel'], security: bearer, middleware: [requireUser] as const,
  summary: 'Aceptar una invitación', request: { params: IdParam },
  responses: { ...ok, ...errorResponses(400, 401, 403, 404) },
});
const rejectInvite = createRoute({
  method: 'post', path: '/api/v1/team-invites/{id}/reject', tags: ['Plantel'], security: bearer, middleware: [requireUser] as const,
  summary: 'Rechazar una invitación', request: { params: IdParam },
  responses: { ...ok, ...errorResponses(400, 401, 403, 404) },
});
const cancelRequest = createRoute({
  method: 'delete', path: '/api/v1/join-requests/{id}', tags: ['Plantel'], security: bearer, middleware: [requireUser] as const,
  summary: 'Cancelar mi pedido para entrar', request: { params: IdParam },
  responses: { ...ok, ...errorResponses(400, 401, 403, 404) },
});
const leave = createRoute({
  method: 'post', path: '/api/v1/teams/{id}/leave', tags: ['Plantel'], security: bearer, middleware: [requireUser] as const,
  summary: 'Salir del equipo', description: 'El capitán tiene que ceder antes la capitanía.',
  request: { params: TeamParam },
  responses: { ...ok, ...errorResponses(400, 401) },
});

// ---------- rutas del capitán (o admin) ----------

const pending = createRoute({
  method: 'get', path: '/api/v1/teams/{id}/pending', tags: ['Plantel'], security: bearer, middleware: [requireUser] as const,
  summary: 'Invitaciones y pedidos del equipo', description: 'Solo el capitán o un admin.',
  request: { params: TeamParam },
  responses: { 200: { description: 'Abiertas', ...json(TeamPending) }, ...errorResponses(401, 403, 404) },
});
const invite = createRoute({
  method: 'post', path: '/api/v1/teams/{id}/invites', tags: ['Plantel'], security: bearer, middleware: [requireUser] as const,
  summary: 'Invitar a un jugador',
  description: `Por \`player_id\` o por \`alias\`. El jugador necesita cuenta y SteamID vinculado, y el equipo no puede estar lleno.`,
  request: { params: TeamParam, body: { required: true, ...json(InviteBody) } },
  responses: { 201: { description: 'Invitación creada', ...json(Created) }, ...errorResponses(400, 401, 403) },
});
const cancelInvite = createRoute({
  method: 'delete', path: '/api/v1/team-invites/{id}', tags: ['Plantel'], security: bearer, middleware: [requireUser] as const,
  summary: 'Cancelar una invitación', request: { params: IdParam },
  responses: { ...ok, ...errorResponses(400, 401, 403, 404) },
});
const acceptRequest = createRoute({
  method: 'post', path: '/api/v1/join-requests/{id}/accept', tags: ['Plantel'], security: bearer, middleware: [requireUser] as const,
  summary: 'Aceptar un pedido para entrar', request: { params: IdParam },
  responses: { ...ok, ...errorResponses(400, 401, 403, 404) },
});
const rejectRequest = createRoute({
  method: 'post', path: '/api/v1/join-requests/{id}/reject', tags: ['Plantel'], security: bearer, middleware: [requireUser] as const,
  summary: 'Rechazar un pedido para entrar', request: { params: IdParam },
  responses: { ...ok, ...errorResponses(400, 401, 403, 404) },
});
const kick = createRoute({
  method: 'delete', path: '/api/v1/teams/{id}/members/{playerId}', tags: ['Plantel'], security: bearer, middleware: [requireUser] as const,
  summary: 'Sacar a un jugador del equipo', description: 'Capitán o admin. Al capitán no se lo puede sacar.',
  request: { params: TeamPlayerParam },
  responses: { ...ok, ...errorResponses(400, 401, 403) },
});
const captain = createRoute({
  method: 'post', path: '/api/v1/teams/{id}/captain', tags: ['Plantel'], security: bearer, middleware: [requireUser] as const,
  summary: 'Ceder la capitanía',
  description: 'Capitán o admin. El nuevo capitán tiene que ser un jugador del plantel con cuenta.',
  request: { params: TeamParam, body: { required: true, ...json(CaptainBody) } },
  responses: { ...ok, ...errorResponses(400, 401, 403) },
});

export const roster = createRouter()
  .openapi(myInvites, async (c) => {
    const { sb, user } = c.var;
    const mine = must(await sb.from('players').select('id').eq('user_id', user.id).maybeSingle());
    if (!mine) return c.json({ invites: [], requests: [] }, 200);
    const rows = mustHave(await openOnly(sb.from('team_invites').select(INVITE).eq('player_id', mine.id)).order('created_at', { ascending: false })) as unknown as InviteRow[];
    const all = rows.map(toInvite);
    return c.json({ invites: all.filter((i) => i.kind === 'invite'), requests: all.filter((i) => i.kind === 'request') }, 200);
  })
  .openapi(joinRequest, async (c) => {
    const id = mustHave(await c.var.sb.rpc('team_request_join', { p_team: c.req.valid('param').id }));
    return c.json({ id }, 201);
  })
  .openapi(acceptInvite, async (c) => {
    const { id } = c.req.valid('param');
    await inviteOfKind(c, id, 'invite');
    must(await c.var.sb.rpc('team_invite_answer', { p_id: id, p_accept: true }));
    return c.body(null, 204);
  })
  .openapi(rejectInvite, async (c) => {
    const { id } = c.req.valid('param');
    await inviteOfKind(c, id, 'invite');
    must(await c.var.sb.rpc('team_invite_answer', { p_id: id, p_accept: false }));
    return c.body(null, 204);
  })
  .openapi(cancelRequest, async (c) => {
    const { id } = c.req.valid('param');
    await inviteOfKind(c, id, 'request');
    must(await c.var.sb.rpc('team_invite_cancel', { p_id: id }));
    return c.body(null, 204);
  })
  .openapi(leave, async (c) => {
    must(await c.var.sb.rpc('team_leave', { p_team: c.req.valid('param').id }));
    return c.body(null, 204);
  })
  .openapi(pending, async (c) => {
    const { id } = c.req.valid('param');
    const { sb, user } = c.var;
    const team = must(await sb.from('teams').select('captain_id').eq('id', id).maybeSingle());
    if (!team) throw notFound('ese equipo');
    if (team.captain_id !== user.id && !(await isAdmin(c))) {
      throw new AppError(403, 'FORBIDDEN', 'Solo el capitán o un admin ve las invitaciones del equipo.');
    }
    const rows = mustHave(await openOnly(sb.from('team_invites').select(INVITE).eq('team_id', id)).order('created_at', { ascending: false })) as unknown as InviteRow[];
    const all = rows.map(toInvite);
    return c.json({ invites: all.filter((i) => i.kind === 'invite'), requests: all.filter((i) => i.kind === 'request') }, 200);
  })
  .openapi(invite, async (c) => {
    const { player_id, alias } = c.req.valid('json');
    const id = mustHave(await c.var.sb.rpc('team_invite', { p_team: c.req.valid('param').id, p_player: player_id, p_alias: alias }));
    return c.json({ id }, 201);
  })
  .openapi(cancelInvite, async (c) => {
    const { id } = c.req.valid('param');
    await inviteOfKind(c, id, 'invite');
    must(await c.var.sb.rpc('team_invite_cancel', { p_id: id }));
    return c.body(null, 204);
  })
  .openapi(acceptRequest, async (c) => {
    const { id } = c.req.valid('param');
    await inviteOfKind(c, id, 'request');
    must(await c.var.sb.rpc('team_invite_answer', { p_id: id, p_accept: true }));
    return c.body(null, 204);
  })
  .openapi(rejectRequest, async (c) => {
    const { id } = c.req.valid('param');
    await inviteOfKind(c, id, 'request');
    must(await c.var.sb.rpc('team_invite_answer', { p_id: id, p_accept: false }));
    return c.body(null, 204);
  })
  .openapi(kick, async (c) => {
    const { id, playerId } = c.req.valid('param');
    must(await c.var.sb.rpc('team_kick', { p_team: id, p_player: playerId }));
    return c.body(null, 204);
  })
  .openapi(captain, async (c) => {
    const { id } = c.req.valid('param');
    const { player_id } = c.req.valid('json');
    const p = must(await c.var.sb.from('players').select('user_id, nick').eq('id', player_id).maybeSingle());
    if (!p) throw notFound('ese jugador');
    if (!p.user_id) throw new AppError(400, 'BUSINESS_RULE', `${p.nick} no tiene cuenta en la web: no puede ser capitán.`);
    must(await c.var.sb.rpc('set_team_captain', { p_team: id, p_user: p.user_id }));
    return c.body(null, 204);
  });
