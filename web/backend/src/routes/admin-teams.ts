import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave, notFound, searchTerm } from '../lib/db';
import { envelope, runList } from '../lib/list';
import { AppError } from '../lib/errors';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import {
  AdminTeamCreate,
  AdminTeamPatch,
  AdminTeamRequestList,
  IdParam,
  MemberBody,
  RankingConfig,
  RoleBody,
  TeamPlayerParam,
  TeamRequestQuery,
  UserIdParam,
} from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';
import { Created } from '../schemas/teams';
import { checkBlocked } from './admin-players';

type C = Context<AppEnv>;
const done = { 204: { description: 'Hecho' } } as const;

/** Usuario de un jugador (para capitán y dueño). */
async function userOf(c: C, playerId: string) {
  const p = must(await c.var.sb.from('players').select('user_id, nick').eq('id', playerId).maybeSingle());
  if (!p) throw notFound('ese jugador');
  if (!p.user_id) throw new AppError(400, 'BUSINESS_RULE', `${p.nick} no tiene cuenta en la web: no puede ser capitán.`);
  return p.user_id;
}

// ---------- equipos ----------

const createTeam = createRoute({
  method: 'post', path: '/api/v1/admin/teams', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Crear un equipo oficial',
  description: 'Con `captain_player_id`, ese jugador queda como dueño, capitán y primer miembro (necesita SteamID).',
  request: { body: { required: true, ...json(AdminTeamCreate) } },
  responses: { 201: { description: 'Creado', ...json(Created) }, ...errorResponses(400, 401, 403, 404) },
});
const patchTeam = createRoute({
  method: 'patch', path: '/api/v1/admin/teams/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Editar un equipo', description: 'Nombre, sigla o capitán. El capitán puede ser cualquier jugador con cuenta.',
  request: { params: IdParam, body: { required: true, ...json(AdminTeamPatch) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});
const deleteTeam = createRoute({
  method: 'delete', path: '/api/v1/admin/teams/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Borrar un equipo', description: 'Falla con un mensaje si tiene partidas o inscripciones.',
  request: { params: IdParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});
const addMember = createRoute({
  method: 'post', path: '/api/v1/admin/teams/{id}/members', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Sumar un jugador al plantel',
  description: 'Directo, sin invitación. Las reglas siguen valiendo: tope de 10, SteamID y choques de torneo o de partida pendiente.',
  request: { params: IdParam, body: { required: true, ...json(MemberBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 409) },
});
const setRole = createRoute({
  method: 'patch', path: '/api/v1/admin/teams/{id}/members/{playerId}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar el rol de un miembro', request: { params: TeamPlayerParam, body: { required: true, ...json(RoleBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});

// ---------- solicitudes de equipo nuevo ----------

const requests = createRoute({
  method: 'get', path: '/api/v1/admin/team-requests', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Solicitudes de equipo nuevo', description: 'Por defecto, las pendientes primero. `has_steam` dice si se puede aprobar.',
  request: { query: TeamRequestQuery },
  responses: { 200: { description: 'Solicitudes', ...json(AdminTeamRequestList) }, ...errorResponses(400, 401, 403) },
});
const approve = createRoute({
  method: 'post', path: '/api/v1/admin/team-requests/{userId}/approve', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Aprobar una solicitud', description: 'Crea el equipo con el usuario como dueño, capitán y primer miembro.',
  request: { params: UserIdParam },
  responses: { 201: { description: 'Equipo creado', ...json(Created) }, ...errorResponses(400, 401, 403) },
});
const reject = createRoute({
  method: 'post', path: '/api/v1/admin/team-requests/{userId}/reject', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Rechazar una solicitud', request: { params: UserIdParam },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

// ---------- ranking ----------

const getRanking = createRoute({
  method: 'get', path: '/api/v1/admin/ranking/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Puntos del ranking',
  responses: { 200: { description: 'Configuración', ...json(RankingConfig) }, ...errorResponses(401, 403) },
});
const putRanking = createRoute({
  method: 'put', path: '/api/v1/admin/ranking/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar los puntos del ranking', description: 'Puntos por partida de torneo ganada y por PCW ganada (0 a 1000). Se aplican a todo el historial.',
  request: { body: { required: true, ...json(RankingConfig) } },
  responses: { 200: { description: 'Guardada', ...json(RankingConfig) }, ...errorResponses(400, 401, 403) },
});

export const adminTeams = createRouter()
  .openapi(createTeam, async (c) => {
    const { name, tag, captain_player_id, force } = c.req.valid('json');
    await checkBlocked(c, [name, tag], force, 'name');
    const captain = captain_player_id ? await userOf(c, captain_player_id) : null;
    const team = mustHave(
      await c.var.sb.from('teams').insert({ name, tag, kind: 'official', owner_id: captain, captain_id: captain }).select('id').single(),
    );
    if (captain_player_id) {
      const added = await c.var.sb.from('team_members').insert({ team_id: team.id, player_id: captain_player_id, joined_at: new Date().toISOString() });
      if (added.error) {
        // Sin el capitán en el plantel el equipo no sirve: se deshace.
        await c.var.sb.from('teams').delete().eq('id', team.id);
        must(added);
      }
    }
    return c.json({ id: team.id }, 201);
  })
  .openapi(patchTeam, async (c) => {
    const { id } = c.req.valid('param');
    const { name, tag, captain_player_id, force } = c.req.valid('json');
    await checkBlocked(c, [name, tag], force, 'name');
    const captain_id = captain_player_id ? await userOf(c, captain_player_id) : undefined;
    const rows = mustHave(await c.var.sb.from('teams').update({ name, tag, captain_id }).eq('id', id).select('id'));
    if (!rows.length) throw notFound('ese equipo');
    return c.body(null, 204);
  })
  .openapi(deleteTeam, async (c) => {
    const gone = mustHave(await c.var.sb.from('teams').delete().eq('id', c.req.valid('param').id).select('id'));
    if (!gone.length) throw notFound('ese equipo');
    return c.body(null, 204);
  })
  .openapi(addMember, async (c) => {
    const { id } = c.req.valid('param');
    const { player_id, role } = c.req.valid('json');
    const r = await c.var.sb.from('team_members').insert({ team_id: id, player_id, role, joined_at: new Date().toISOString() });
    if (r.error?.code === '23505') throw new AppError(409, 'CONFLICT', 'Ese jugador ya está en el equipo.');
    must(r);
    return c.body(null, 204);
  })
  .openapi(setRole, async (c) => {
    const { id, playerId } = c.req.valid('param');
    const rows = mustHave(
      await c.var.sb.from('team_members').update({ role: c.req.valid('json').role }).eq('team_id', id).eq('player_id', playerId).is('left_at', null).select('id'),
    );
    if (!rows.length) throw notFound('ese jugador en el plantel');
    return c.body(null, 204);
  })
  .openapi(requests, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('admin_team_requests').select('user_id, alias, has_steam, name, tag, status', { count: 'exact' });
    if (p.status) q = q.eq('status', p.status);
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    type Row = { user_id: string; alias: string | null; has_steam: boolean; name: string; tag: string | null; status: string };
    const { rows, total } = await runList<Row, typeof q>(q, p, { status: ['status_order', 'name'] }, 'user_id');
    return c.json(envelope(rows, total, p), 200);
  })
  .openapi(approve, async (c) => {
    const id = mustHave(await c.var.sb.rpc('approve_team_request', { p_user: c.req.valid('param').userId }));
    return c.json({ id }, 201);
  })
  .openapi(reject, async (c) => {
    must(await c.var.sb.rpc('reject_team_request', { p_user: c.req.valid('param').userId }));
    return c.body(null, 204);
  })
  .openapi(getRanking, async (c) => {
    const r = must(await c.var.sb.from('ranking_config').select('win_official, win_pcw').eq('id', 1).maybeSingle());
    if (!r) throw new AppError(500, 'INTERNAL', 'Falta la configuración del ranking.');
    return c.json(r, 200);
  })
  .openapi(putRanking, async (c) => {
    const { win_official, win_pcw } = c.req.valid('json');
    must(await c.var.sb.rpc('set_ranking_config', { p_official: win_official, p_pcw: win_pcw }));
    return c.json({ win_official, win_pcw }, 200);
  });
