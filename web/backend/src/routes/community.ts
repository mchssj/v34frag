import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { requireUser } from '../lib/auth';
import { must } from '../lib/db';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { bearer, errorResponses, json } from '../schemas/common';

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
