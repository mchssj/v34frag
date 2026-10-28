import { createRoute } from '@hono/zod-openapi';
import { bodyLimit } from 'hono/body-limit';
import { optionalUser, requireUser } from '../lib/auth';
import { must, mustHave } from '../lib/db';
import { AppError, fromPostgrest } from '../lib/errors';
import { createRouter } from '../lib/router';
import { LOGO_MAX_BYTES, LOGO_SHAPE } from '../lib/uploads';
import { bearer, errorResponses, json } from '../schemas/common';
import { AliasAvailability, AliasBody, AliasParam, AliasResult, LOGO_HELP, TeamRequest, TeamRequestBody, TeamRequestForm } from '../schemas/teams';
import { dropPhoto, removePhoto, savePhoto } from '../services/photos';

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
    'SteamID vinculado (quien la pide queda como dueño, capitán y primer jugador). La aprueba un admin. ' +
    `JSON con \`name\` y \`tag\`, o \`multipart/form-data\` con \`name\`, \`tag\` y \`logo\` opcional (${LOGO_HELP}). ` +
    'Sin `logo` se conserva el que ya tenía la solicitud. Al aprobarla, el logo pasa al equipo.',
  security: bearer,
  middleware: [
    requireUser,
    bodyLimit({
      maxSize: LOGO_MAX_BYTES + 16 * 1024,
      onError: () => {
        throw new AppError(413, 'FILE_TOO_LARGE', `La imagen pesa más de ${LOGO_MAX_BYTES / 1024} KB.`);
      },
    }),
  ] as const,
  request: {
    // required: false para que cada validador corra solo con su Content-Type (con true corren los dos).
    body: {
      required: false,
      content: { 'application/json': { schema: TeamRequestBody }, 'multipart/form-data': { schema: TeamRequestForm } },
    },
  },
  responses: { 200: { description: 'Solicitud pendiente', ...json(TeamRequest) }, ...errorResponses(400, 401, 413) },
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
    const r = must(await sb.from('team_requests').select('name, tag, status, logo_url').eq('user_id', user.id).maybeSingle());
    return c.json(r ? { ...r, status: r.status as 'pending' | 'approved' | 'rejected' } : null, 200);
  })
  .openapi(putTeamRequest, async (c) => {
    const { sb, user } = c.var;
    const form = (c.req.header('content-type') ?? '').startsWith('multipart/form-data');
    // El tipo de `form` no trae el archivo opcional: se declara a mano.
    const { name, tag, logo } = form ? (c.req.valid('form') as { name: string; tag: string; logo?: File }) : { ...c.req.valid('json'), logo: undefined };
    if (!name || !tag) throw new AppError(400, 'VALIDATION_ERROR', 'Falta el nombre o la sigla del equipo (JSON o multipart/form-data).');
    const prev = logo ? must(await sb.from('team_requests').select('logo_url, status').eq('user_id', user.id).maybeSingle()) : null;
    const up = logo ? await savePhoto(c, `team-requests/${user.id}`, logo, LOGO_MAX_BYTES, LOGO_SHAPE) : null;
    const r = await sb
      .from('team_requests')
      .upsert({ user_id: user.id, name, tag, status: 'pending', ...(up ? { logo_url: up.url } : {}) })
      .select('name, tag, status, logo_url')
      .single();
    if (r.error) {
      if (up) await dropPhoto(c, up.path);
      throw fromPostgrest(r.error);
    }
    // El logo de una solicitud ya aprobada es el del equipo: ese no se borra.
    if (up && prev?.status !== 'approved') removePhoto(c, prev?.logo_url);
    return c.json({ ...r.data, status: r.data.status as 'pending' | 'approved' | 'rejected' }, 200);
  });
