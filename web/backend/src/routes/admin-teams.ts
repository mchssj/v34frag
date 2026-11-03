import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { isAdmin, requireAdmin, requireModerator, requireUser } from '../lib/auth';
import { must, mustHave, notFound, searchTerm } from '../lib/db';
import { envelope, runList } from '../lib/list';
import { AppError } from '../lib/errors';
import { createRouter } from '../lib/router';
import { removePhoto } from '../services/photos';
import type { AppEnv } from '../lib/types';
import {
  AdminTeamCreate,
  AdminTeamList,
  AdminTeamPatch,
  AdminTeamQuery,
  ReasonBody,
  TeamAuditList,
  TeamAuditQuery,
  IdParam,
  MemberBody,
  RankingConfig,
  RoleBody,
  TeamPlayerParam,
} from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';
import { Created, TeamConfig } from '../schemas/teams';
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
const listTeams = createRoute({
  method: 'get', path: '/api/v1/admin/teams', tags: ['Admin'], security: bearer, middleware: [requireUser, requireModerator] as const,
  summary: 'Equipos para moderar',
  description: 'Moderadores y admins. Solo los activos (un disuelto es como si no existiera). Con líder, plantel, torneos activos, palabra bloqueada y último cambio.',
  request: { query: AdminTeamQuery },
  responses: { 200: { description: 'Equipos', ...json(AdminTeamList) }, ...errorResponses(400, 401, 403) },
});
const history = createRoute({
  method: 'get', path: '/api/v1/admin/teams/{id}/history', tags: ['Admin'], security: bearer, middleware: [requireUser, requireModerator] as const,
  summary: 'Historial de un equipo',
  description: 'Moderadores y admins: cada cambio de nombre y sigla, logo, líder, plantel, roles y disolución, con quién (y su rol) y el motivo.',
  request: { params: IdParam, query: TeamAuditQuery },
  responses: { 200: { description: 'Historial', ...json(TeamAuditList) }, ...errorResponses(400, 401, 403) },
});
const removeLogo = createRoute({
  method: 'post', path: '/api/v1/admin/teams/{id}/logo/remove', tags: ['Admin'], security: bearer, middleware: [requireUser, requireModerator] as const,
  summary: 'Quitar el logo de un equipo', description: 'Moderadores y admins. El líder recibe el aviso `team_staff_action` con el motivo, si lo hay.',
  request: { params: IdParam, body: { required: false, ...json(ReasonBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});
const removeMember = createRoute({
  method: 'post', path: '/api/v1/admin/teams/{id}/members/{playerId}/remove', tags: ['Admin'], security: bearer, middleware: [requireUser, requireModerator] as const,
  summary: 'Quitar a un miembro',
  description: 'Moderadores y admins. Al líder no (`409`: primero un admin cambia el líder). El jugador recibe `team_removed` y el líder `team_staff_action`, con el motivo si lo hay.',
  request: { params: TeamPlayerParam, body: { required: false, ...json(ReasonBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 404, 409) },
});
const dissolveTeam = createRoute({
  method: 'post', path: '/api/v1/admin/teams/{id}/dissolve', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Disolver un equipo', description: 'Solo admin. Deja de existir (no se reactiva). `409` si está inscrito en un torneo abierto o en curso.',
  request: { params: IdParam, body: { required: false, ...json(ReasonBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 404, 409) },
});
const patchTeam = createRoute({
  method: 'patch', path: '/api/v1/admin/teams/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireModerator] as const,
  summary: 'Editar un equipo',
  description:
    'Nombre y sigla: moderadores y admins, sin la espera de 30 días del equipo (que sigue contando desde su último cambio). Líder (`captain_player_id`, ' +
    'del plantel y con cuenta): solo admin, sin el tope de equipos por líder. `force` (guardar con una palabra bloqueada) es solo de admin. ' +
    'El líder recibe `team_staff_action` con el motivo, si lo hay.',
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
  description: 'Solo admin. Directo, sin invitación. Las reglas siguen valiendo: máximo de miembros, SteamID y choques de torneo o de partida pendiente. Avisa al jugador y al líder.',
  request: { params: IdParam, body: { required: true, ...json(MemberBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 409) },
});
const setRole = createRoute({
  method: 'patch', path: '/api/v1/admin/teams/{id}/members/{playerId}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar el rol de un miembro', description: 'Solo admin. Avisa al jugador y al líder.',
  request: { params: TeamPlayerParam, body: { required: true, ...json(RoleBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});

// ---------- plantel ----------

const getTeamConfig = createRoute({
  method: 'get', path: '/api/v1/admin/teams/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Configuración de los equipos', description: 'Máximo de miembros y de cuántos equipos puede ser capitán una persona.',
  responses: { 200: { description: 'Configuración', ...json(TeamConfig) }, ...errorResponses(401, 403) },
});
const putTeamConfig = createRoute({
  method: 'put', path: '/api/v1/admin/teams/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar la configuración de los equipos',
  description:
    '`max_members` entre 2 y 30 (10 por defecto), para todos los equipos oficiales. Si un equipo ya tiene más, nadie sale: solo no entra gente nueva ' +
    '(`409 ROSTER_FULL` al invitar o aceptar). `max_led` entre 1 y 10 (1 por defecto): de cuántos equipos oficiales activos puede ser capitán una ' +
    'persona al crear un equipo o recibir la capitanía (el admin no tiene tope). Bajarlo no saca a nadie de la capitanía. `rename_days` entre 0 y 365 ' +
    '(30 por defecto, 0 = sin espera): cada cuántos días el capitán puede cambiar el nombre o la sigla.',
  request: { body: { required: true, ...json(TeamConfig) } },
  responses: { 200: { description: 'Guardada', ...json(TeamConfig) }, ...errorResponses(400, 401, 403) },
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
  .openapi(listTeams, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb
      .from('admin_team_list')
      .select('id, name, tag, logo_url, founded_at, captain_player_id, captain_alias, members, players, events_active, blocked, last_change_at', { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    if (p.filter === 'blocked') q = q.eq('blocked', true);
    if (p.filter === 'incomplete') q = q.lt('players', 5);
    if (p.filter === 'no_leader') q = q.is('captain_player_id', null);
    if (p.filter === 'in_event') q = q.gt('events_active', 0);
    type Row = {
      id: string; name: string; tag: string | null; logo_url: string | null; founded_at: string | null; captain_player_id: string | null;
      captain_alias: string | null; members: number; players: number; events_active: number; blocked: boolean; last_change_at: string | null;
    };
    const { rows, total } = await runList<Row, typeof q>(q, p, { name: ['name'], last_change: ['last_change_at'], members: ['members'] }, 'id');
    return c.json(
      envelope(
        rows.map((r) => ({
          id: r.id, name: r.name, tag: r.tag, logo_url: r.logo_url, founded_at: r.founded_at,
          captain: r.captain_player_id ? { player_id: r.captain_player_id, alias: r.captain_alias ?? '' } : null,
          members: r.members, players: r.players, events_active: r.events_active, blocked: r.blocked, last_change_at: r.last_change_at,
        })),
        total,
        p,
      ),
      200,
    );
  })
  .openapi(history, async (c) => {
    const { id } = c.req.valid('param');
    const p = c.req.valid('query');
    const q = c.var.sb.from('team_audit').select('id, at, actor_id, actor_role, action, data, reason', { count: 'exact' }).eq('team_id', id);
    type Row = { id: number; at: string; actor_id: string | null; actor_role: string; action: string; data: Record<string, unknown>; reason: string | null };
    const { rows, total } = await runList<Row, typeof q>(q, p, { at: ['id'] }, 'id'); // el id crece con cada cambio (varios pueden tener la misma hora)
    const ids = [...new Set(rows.flatMap((r) => (r.actor_id ? [r.actor_id] : [])))];
    // El alias sale de la ficha del jugador (pública); profiles solo deja leer el propio.
    const names = ids.length ? mustHave(await c.var.sb.from('players').select('user_id, nick').in('user_id', ids)) : [];
    const alias = new Map(names.map((n) => [n.user_id, n.nick]));
    return c.json(
      envelope(
        rows.map((r) => ({
          id: r.id, at: r.at, actor: { user_id: r.actor_id, alias: r.actor_id ? (alias.get(r.actor_id) ?? null) : null },
          actor_role: r.actor_role as 'team' | 'moderator' | 'admin' | 'system', action: r.action, data: r.data ?? {}, reason: r.reason,
        })),
        total,
        p,
      ),
      200,
    );
  })
  .openapi(patchTeam, async (c) => {
    const { id } = c.req.valid('param');
    const { name, tag, captain_player_id, force, reason } = c.req.valid('json');
    const admin = await isAdmin(c);
    if (captain_player_id && !admin) throw new AppError(403, 'FORBIDDEN', 'Solo un admin cambia el líder.');
    // Las palabras bloqueadas: el admin puede forzar; al moderador lo frena la base.
    if (admin) await checkBlocked(c, [name, tag], force, 'name');
    if (name !== undefined || tag !== undefined) {
      const team = must(await c.var.sb.from('teams').select('name, tag').eq('id', id).maybeSingle());
      if (!team) throw notFound('ese equipo');
      must(await c.var.sb.rpc('team_staff_rename', { p_team: id, p_name: name ?? team.name, p_tag: tag ?? team.tag ?? '', p_reason: reason ?? '' }));
    }
    if (captain_player_id) must(await c.var.sb.rpc('team_staff_set_captain', { p_team: id, p_player: captain_player_id, p_reason: reason ?? '' }));
    return c.body(null, 204);
  })
  .openapi(removeLogo, async (c) => {
    const reason = (c.req.valid('json') as { reason?: string } | undefined)?.reason;
    const url = must(await c.var.sb.rpc('team_staff_remove_logo', { p_team: c.req.valid('param').id, p_reason: reason ?? '' }));
    removePhoto(c, url as string | null);
    return c.body(null, 204);
  })
  .openapi(removeMember, async (c) => {
    const { id, playerId } = c.req.valid('param');
    const reason = (c.req.valid('json') as { reason?: string } | undefined)?.reason;
    must(await c.var.sb.rpc('team_staff_remove_member', { p_team: id, p_player: playerId, p_reason: reason ?? '' }));
    return c.body(null, 204);
  })
  .openapi(dissolveTeam, async (c) => {
    const reason = (c.req.valid('json') as { reason?: string } | undefined)?.reason;
    must(await c.var.sb.rpc('team_staff_dissolve', { p_team: c.req.valid('param').id, p_reason: reason ?? '' }));
    return c.body(null, 204);
  })
  .openapi(deleteTeam, async (c) => {
    const gone = mustHave(await c.var.sb.from('teams').delete().eq('id', c.req.valid('param').id).select('id'));
    if (!gone.length) throw notFound('ese equipo');
    return c.body(null, 204);
  })
  .openapi(addMember, async (c) => {
    const { id } = c.req.valid('param');
    const { player_id, role, reason } = c.req.valid('json');
    must(await c.var.sb.rpc('team_staff_add_member', { p_team: id, p_player: player_id, p_role: role, p_reason: reason ?? '' }));
    return c.body(null, 204);
  })
  .openapi(setRole, async (c) => {
    const { id, playerId } = c.req.valid('param');
    const { role, reason } = c.req.valid('json');
    must(await c.var.sb.rpc('team_staff_set_role', { p_team: id, p_player: playerId, p_role: role, p_reason: reason ?? '' }));
    return c.body(null, 204);
  })
  .openapi(getTeamConfig, async (c) => {
    const r = must(await c.var.sb.from('team_config').select('max_members, max_led, rename_days').eq('id', 1).maybeSingle());
    if (!r) throw new AppError(500, 'INTERNAL', 'Falta la configuración del plantel.');
    return c.json(r, 200);
  })
  .openapi(putTeamConfig, async (c) => {
    const { max_members, max_led, rename_days } = c.req.valid('json');
    must(await c.var.sb.rpc('set_team_config', { p_max_members: max_members, p_max_led: max_led, p_rename_days: rename_days }));
    return c.json({ max_members, max_led, rename_days }, 200);
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
