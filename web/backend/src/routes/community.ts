import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { optionalUser, requireUser } from '../lib/auth';
import { must } from '../lib/db';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { bearer, errorResponses, json } from '../schemas/common';

// Comentarios y votos en los perfiles (replanteo 91, docs/bitacora/2026-11-09-comentarios-perfil).
// Visitas a tu perfil (replanteo 86, bitácora docs/bitacora/2026-11-07-visitas-al-perfil) y la página del Equipo
// (replanteo 87, docs/bitacora/2026-11-07-pagina-equipo). Las reglas las aplica la base.

type C = Context<AppEnv>;
const rpc = async (c: C, fn: string, args: Record<string, unknown> = {}) =>
  must(await c.var.sb.rpc(fn as never, args as never)) as unknown;

const Id = z.uuid();
const IdParam = z.object({ id: Id.openapi({ param: { name: 'id', in: 'path' } }) });

// ---------- visitas ----------

const Visitor = z
  .object({
    player_id: Id,
    nick: z.string(),
    photo_url: z.string().nullable(),
    level: z.number().int(),
    visited_at: z.string(),
  })
  .openapi('ProfileVisitor');

export const ProfileVisits = z
  .object({
    vip: z.boolean(),
    total: z.number().int().openapi({ description: 'Jugadores distintos que visitaron tu perfil en los últimos 30 días' }),
    week: z.number().int().openapi({ description: 'Los de los últimos 7 días' }),
    items: z.array(Visitor).nullable().openapi({ description: 'Solo VIP: quiénes (hasta 100, el más reciente primero). Sin VIP, `null`' }),
    incognito: z
      .object({
        enabled: z.boolean(),
        used: z.number().int().openapi({ description: 'Perfiles distintos visitados ocultos esta semana' }),
        limit: z.number().int(),
        resets_at: z.string().openapi({ description: 'El lunes siguiente, 00:00 de Bogotá' }),
      })
      .nullable()
      .openapi({ description: 'Solo VIP: navegar sin dejar rastro. Sin VIP, `null`' }),
  })
  .openapi('ProfileVisits');

const visit = createRoute({
  method: 'post', path: '/api/v1/players/{id}/visit', tags: ['Jugadores'], security: bearer, middleware: [requireUser] as const,
  summary: 'Registrar la visita a un perfil',
  description:
    'Una por visitante, perfil y día. No cuentan las propias, las de una cuenta sin ficha ni las de una ficha sin cuenta. ' +
    'Un VIP con el modo oculto prendido visita oculto hasta 15 perfiles por semana.',
  request: { params: IdParam },
  responses: { 204: { description: 'Registrada (o ignorada)' }, ...errorResponses(400, 401) },
});
const myVisits = createRoute({
  method: 'get', path: '/api/v1/me/profile-visits', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Las visitas a mi perfil',
  description: 'Cuántos jugadores visitaron tu perfil; si eres VIP, también quiénes y el estado del modo oculto.',
  responses: { 200: { description: 'Visitas', ...json(ProfileVisits) }, ...errorResponses(401) },
});
const Incognito = z.object({ enabled: z.boolean() }).openapi('ProfileIncognito');
const setIncognito = createRoute({
  method: 'put', path: '/api/v1/me/profile-visits/incognito', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Navegar sin dejar rastro',
  description: 'Prenderlo es solo para VIP (`403`). Apagarlo, para cualquiera.',
  request: { body: { required: true, ...json(Incognito) } },
  responses: { 200: { description: 'Visitas', ...json(ProfileVisits) }, ...errorResponses(400, 401, 403) },
});

// ---------- comentarios y votos ----------

const WallComment = z
  .object({
    id: Id,
    body: z.string(),
    created_at: z.string(),
    author: z.object({
      player_id: Id,
      nick: z.string(),
      photo_url: z.string().nullable(),
      level: z.number().int(),
      verified: z.enum(['gray', 'gold']).nullable(),
    }),
    mine: z.boolean(),
    can_delete: z.boolean().openapi({ description: 'El autor, el dueño del perfil y los moderadores o admins' }),
  })
  .openapi('ProfileWallComment');
export const ProfileWall = z
  .object({
    likes: z.number().int(),
    dislikes: z.number().int(),
    my_vote: z.union([z.literal(1), z.literal(-1)]).nullable(),
    can_vote: z.boolean().openapi({ description: 'Con sesión y ficha, y no es el perfil propio' }),
    is_owner: z.boolean(),
    comments_open: z.boolean().openapi({ description: 'El dueño puede cerrarlos. Cerrados, no se ven ni se dejan' }),
    can_comment: z.boolean(),
    total: z.number().int(),
    items: z.array(WallComment).openapi({ description: 'Los más nuevos primero, 20 por página' }),
  })
  .openapi('ProfileWall');
const WallQuery = z.object({ before: z.string().datetime({ offset: true }).optional().openapi({ description: 'Los anteriores a esta fecha (para "Ver más")' }) });
const wall = createRoute({
  method: 'get', path: '/api/v1/players/{id}/wall', tags: ['Jugadores'], middleware: [optionalUser] as const,
  summary: 'Los votos y comentarios de un perfil',
  description: 'También sin sesión (solo para leer). `my_vote`, `can_vote` y `can_comment` dependen de quién consulta.',
  request: { params: IdParam, query: WallQuery },
  responses: { 200: { description: 'Muro', ...json(ProfileWall) }, ...errorResponses(400, 401, 404) },
});
const Vote = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]).openapi({ description: '1 me gusta, -1 no me gusta, 0 lo saca' }) }).openapi('ProfileVote');
const vote = createRoute({
  method: 'put', path: '/api/v1/players/{id}/vote', tags: ['Jugadores'], security: bearer, middleware: [requireUser] as const,
  summary: 'Votar un perfil', description: 'Un voto por cuenta y perfil. No el propio.',
  request: { params: IdParam, body: { required: true, ...json(Vote) } },
  responses: { 200: { description: 'Muro', ...json(ProfileWall) }, ...errorResponses(400, 401, 403, 404) },
});
const NewComment = z.object({ body: z.string().min(1).max(280) }).openapi('ProfileNewComment');
const addComment = createRoute({
  method: 'post', path: '/api/v1/players/{id}/comments', tags: ['Jugadores'], security: bearer, middleware: [requireUser] as const,
  summary: 'Comentar un perfil',
  description: 'Hasta 280 caracteres. 30 segundos entre comentarios y 30 por día (`400` con el motivo). No si el dueño los cerró (`403`).',
  request: { params: IdParam, body: { required: true, ...json(NewComment) } },
  responses: { 200: { description: 'Muro', ...json(ProfileWall) }, ...errorResponses(400, 401, 403, 404) },
});
const deleteComment = createRoute({
  method: 'delete', path: '/api/v1/profile-comments/{id}', tags: ['Jugadores'], security: bearer, middleware: [requireUser] as const,
  summary: 'Borrar un comentario', description: 'El autor, el dueño del perfil o un moderador o admin.',
  request: { params: IdParam },
  responses: { 204: { description: 'Borrado' }, ...errorResponses(400, 401, 403, 404) },
});
const CommentsOpen = z.object({ open: z.boolean() }).openapi('ProfileCommentsOpen');
const setCommentsOpen = createRoute({
  method: 'put', path: '/api/v1/me/profile-comments', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Abrir o cerrar los comentarios de mi perfil',
  request: { body: { required: true, ...json(CommentsOpen) } },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401) },
});
const wallOf = async (c: C, player: string) =>
  c.json((await rpc(c, 'profile_wall', { p_player: player })) as z.infer<typeof ProfileWall>, 200);

// ---------- Equipo ----------

const StaffCard = z
  .object({ player_id: Id, nick: z.string(), photo_url: z.string().nullable(), level: z.number().int() })
  .openapi('StaffCard');
export const Staff = z
  .object({
    admins: z.array(StaffCard),
    moderators: z.array(StaffCard),
    vips: z.array(StaffCard.extend({ since: z.string() })).openapi({ description: 'VIP activos, sin los admins ni los que se ocultaron, por antigüedad' }),
  })
  .openapi('Staff');
const staff = createRoute({
  method: 'get', path: '/api/v1/staff', tags: ['Comunidad'], security: bearer, middleware: [requireUser] as const,
  summary: 'El equipo de CMLeague',
  description: 'Los admins, los moderadores y los VIP (página del Equipo). Las cuentas sin ficha de jugador no salen.',
  responses: { 200: { description: 'Equipo', ...json(Staff) }, ...errorResponses(401) },
});
const VipList = z
  .object({ vip: z.boolean(), hidden: z.boolean().openapi({ description: 'Si te ocultaste de la lista de VIP de la página del Equipo' }) })
  .openapi('VipListMe');
const vipListMe = createRoute({
  method: 'get', path: '/api/v1/me/vip-list', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Mi lugar en la lista de VIP',
  responses: { 200: { description: 'Estado', ...json(VipList) }, ...errorResponses(401) },
});
const VipListPatch = z.object({ hidden: z.boolean() }).openapi('VipListPatch');
const vipListSet = createRoute({
  method: 'put', path: '/api/v1/me/vip-list', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Ocultarme o mostrarme en la lista de VIP',
  request: { body: { required: true, ...json(VipListPatch) } },
  responses: { 200: { description: 'Estado', ...json(VipList) }, ...errorResponses(400, 401) },
});

export const community = createRouter()
  .openapi(wall, async (c) =>
    c.json((await rpc(c, 'profile_wall', { p_player: c.req.valid('param').id, p_before: c.req.valid('query').before ?? null })) as z.infer<typeof ProfileWall>, 200))
  .openapi(vote, async (c) => {
    const { id } = c.req.valid('param');
    await rpc(c, 'profile_vote', { p_player: id, p_value: c.req.valid('json').value });
    return wallOf(c, id);
  })
  .openapi(addComment, async (c) => {
    const { id } = c.req.valid('param');
    await rpc(c, 'profile_comment_add', { p_player: id, p_body: c.req.valid('json').body });
    return wallOf(c, id);
  })
  .openapi(deleteComment, async (c) => {
    await rpc(c, 'profile_comment_delete', { p_id: c.req.valid('param').id });
    return c.body(null, 204);
  })
  .openapi(setCommentsOpen, async (c) => {
    await rpc(c, 'profile_comments_set', { p_open: c.req.valid('json').open });
    return c.body(null, 204);
  })
  .openapi(visit, async (c) => {
    await rpc(c, 'profile_visit', { p_player: c.req.valid('param').id });
    return c.body(null, 204);
  })
  .openapi(myVisits, async (c) => c.json((await rpc(c, 'my_profile_visits')) as z.infer<typeof ProfileVisits>, 200))
  .openapi(setIncognito, async (c) => {
    await rpc(c, 'profile_incognito_set', { p_on: c.req.valid('json').enabled });
    return c.json((await rpc(c, 'my_profile_visits')) as z.infer<typeof ProfileVisits>, 200);
  })
  .openapi(staff, async (c) => c.json((await rpc(c, 'staff_public')) as z.infer<typeof Staff>, 200))
  .openapi(vipListMe, async (c) => c.json((await rpc(c, 'vip_list_me')) as z.infer<typeof VipList>, 200))
  .openapi(vipListSet, async (c) => {
    await rpc(c, 'vip_list_hidden_set', { p_hidden: c.req.valid('json').hidden });
    return c.json((await rpc(c, 'vip_list_me')) as z.infer<typeof VipList>, 200);
  });
