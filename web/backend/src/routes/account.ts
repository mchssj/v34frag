import { createRoute } from '@hono/zod-openapi';
import { optionalUser, requireUser } from '../lib/auth';
import { must, mustHave } from '../lib/db';
import { createRouter } from '../lib/router';
import { bearer, errorResponses, json } from '../schemas/common';
import { AliasAvailability, AliasBody, AliasParam, AliasResult, TeamRequest, TeamRequestBody } from '../schemas/teams';

export const ALIAS_WAIT_DAYS = 15;
const nextChange = (changedAt: string | null) =>
  changedAt ? new Date(new Date(changedAt).getTime() + ALIAS_WAIT_DAYS * 86_400_000).toISOString() : null;

const putAlias = createRoute({
  method: 'put',
  path: '/api/v1/me/alias',
  tags: ['Mi perfil'],
  summary: 'Cambiar mi alias',
  description:
    `El alias es el nombre en toda la web: único (sin distinguir mayúsculas), de 2 a 24 caracteres y sin palabras ` +
    `bloqueadas. Se puede cambiar una vez cada ${ALIAS_WAIT_DAYS} días (cambiar solo mayúsculas no cuenta). ` +
    '`409 CONFLICT` si está tomado; `400 BUSINESS_RULE` si falta esperar o tiene una palabra no permitida.',
  security: bearer,
  middleware: [requireUser] as const,
  request: { body: { required: true, ...json(AliasBody) } },
  responses: { 200: { description: 'Alias guardado', ...json(AliasResult) }, ...errorResponses(400, 401, 409) },
});

const available = createRoute({
  method: 'get',
  path: '/api/v1/aliases/{alias}/available',
  tags: ['Mi perfil'],
  summary: 'Si un alias está libre',
  description: 'Para validar mientras se escribe (registro y Mi perfil). Con sesión, el alias propio cuenta como libre.',
  middleware: [optionalUser] as const,
  request: { params: AliasParam },
  responses: { 200: { description: 'Resultado', ...json(AliasAvailability) }, ...errorResponses(400, 401) },
});

const getTeamRequest = createRoute({
  method: 'get',
  path: '/api/v1/me/team-request',
  tags: ['Equipos'],
  summary: 'Mi solicitud de equipo nuevo',
  description: 'null si nunca pidió uno.',
  security: bearer,
  middleware: [requireUser] as const,
  responses: { 200: { description: 'Solicitud', ...json(TeamRequest.nullable()) }, ...errorResponses(401) },
});

const putTeamRequest = createRoute({
  method: 'put',
  path: '/api/v1/me/team-request',
  tags: ['Equipos'],
  summary: 'Pedir un equipo nuevo',
  description:
    'Una solicitud por usuario: enviarla de nuevo la reemplaza y vuelve a quedar pendiente. Hace falta tener el ' +
    'SteamID vinculado (quien la pide queda como dueño, capitán y primer jugador). La aprueba un admin.',
  security: bearer,
  middleware: [requireUser] as const,
  request: { body: { required: true, ...json(TeamRequestBody) } },
  responses: { 200: { description: 'Solicitud pendiente', ...json(TeamRequest) }, ...errorResponses(400, 401) },
});

export const account = createRouter()
  .openapi(putAlias, async (c) => {
    const { sb, user } = c.var;
    must(await sb.rpc('set_my_tag', { p_tag: c.req.valid('json').alias }));
    const p = mustHave(await sb.from('profiles').select('tag, tag_changed_at').eq('id', user.id).single());
    return c.json({ alias: p.tag ?? '', changed_at: p.tag_changed_at, next_change_at: nextChange(p.tag_changed_at) }, 200);
  })
  .openapi(available, async (c) => {
    const alias = c.req.valid('param').alias.trim();
    const reason = mustHave(await c.var.sb.rpc('alias_check', { p_tag: alias }));
    return c.json(
      { alias, available: reason === 'ok', reason: reason === 'ok' ? null : (reason as 'length' | 'chars' | 'blocked' | 'taken') },
      200,
    );
  })
  .openapi(getTeamRequest, async (c) => {
    const { sb, user } = c.var;
    const r = must(await sb.from('team_requests').select('name, tag, status').eq('user_id', user.id).maybeSingle());
    return c.json(r ? { ...r, status: r.status as 'pending' | 'approved' | 'rejected' } : null, 200);
  })
  .openapi(putTeamRequest, async (c) => {
    const { sb, user } = c.var;
    const { name, tag } = c.req.valid('json');
    const r = mustHave(
      await sb.from('team_requests').upsert({ user_id: user.id, name, tag, status: 'pending' }).select('name, tag, status').single(),
    );
    return c.json({ ...r, status: r.status as 'pending' | 'approved' | 'rejected' }, 200);
  });
