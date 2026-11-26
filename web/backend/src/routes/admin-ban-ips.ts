import { createRoute, z } from '@hono/zod-openapi';
import { requireAdmin, requireUser } from '../lib/auth';
import { must } from '../lib/db';
import { AppError } from '../lib/errors';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import {
  BanIpAddBody,
  BanIpExceptionBody,
  CreatedId,
  BanIpList,
  BanIpQuery,
  BanIpsBody,
  BanIpsResult,
  IdParam,
  IpCandidateList,
  IpCandidateQuery,
  IpRangeAccountList,
  IpRangeAccountQuery,
} from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';

const done = { 204: { description: 'Hecho' } } as const;

// Baneo por IP desde la web (replanteo 149, plan docs/bitacora/2026-11-26-baneo-por-ip). Solo admins: son los únicos
// que ven las IPs. El freno (cola, aceptar, grupos y registro) lo hacen la base y el registro de la API.


const candidates = createRoute({
  method: 'get', path: '/api/v1/admin/ip-candidates', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Las IPs de una ficha o de una cuenta, para banearlas',
  description: 'De los servidores (por sus SteamID) y de la web (al iniciar sesión y entrar a la cola), con las otras fichas o cuentas que usaron la misma IP.',
  request: { query: IpCandidateQuery },
  responses: { 200: { description: 'IPs', ...json(IpCandidateList) }, ...errorResponses(400, 401, 403) },
});
const rangeAccounts = createRoute({
  method: 'get', path: '/api/v1/admin/ip-ranges/accounts', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'A quién afecta banear un rango',
  description: 'Las fichas y cuentas que usaron alguna IP del rango, en los servidores o en la web.',
  request: { query: IpRangeAccountQuery },
  responses: { 200: { description: 'Fichas y cuentas', ...json(IpRangeAccountList) }, ...errorResponses(400, 401, 403) },
});
const banIps = createRoute({
  method: 'get', path: '/api/v1/admin/bans/{id}/ips', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Las IPs y rangos de un baneo', request: { params: IdParam, query: BanIpQuery },
  responses: { 200: { description: 'IPs', ...json(BanIpList) }, ...errorResponses(400, 401, 403) },
});
const setBanIps = createRoute({
  method: 'put', path: '/api/v1/admin/bans/{id}/ips', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Banear IPs o rangos con un baneo',
  description: 'Deja exactamente esas IPs y rangos: los nuevos se banean y los que ya no están se levantan. Vencen con el baneo, como mucho a los 30 días.',
  request: { params: IdParam, body: { required: true, ...json(BanIpsBody) } },
  responses: { 200: { description: 'Cuántas quedaron', ...json(BanIpsResult) }, ...errorResponses(400, 401, 403, 404) },
});
const liftBanIp = createRoute({
  method: 'delete', path: '/api/v1/admin/ban-ips/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Levantar una IP o rango de un baneo', request: { params: IdParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});

const addBanIp = createRoute({
  method: 'post', path: '/api/v1/admin/bans/{id}/ip', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Banear una IP o rango, con excepciones',
  description: 'Suma una IP o rango al baneo (vence con él, como mucho a los 30 días), con las fichas y cuentas que siguen pudiendo buscar partida desde ahí.',
  request: { params: IdParam, body: { required: true, ...json(BanIpAddBody) } },
  responses: { 201: { description: 'La IP baneada', ...json(CreatedId) }, ...errorResponses(400, 401, 403, 404) },
});
const addException = createRoute({
  method: 'post', path: '/api/v1/admin/ban-ips/{id}/exceptions', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Exceptuar una ficha o cuenta de una IP o rango baneado',
  request: { params: IdParam, body: { required: true, ...json(BanIpExceptionBody) } },
  responses: { 201: { description: 'La excepción', ...json(CreatedId) }, ...errorResponses(400, 401, 403, 404) },
});
const removeException = createRoute({
  method: 'delete', path: '/api/v1/admin/ban-ip-exceptions/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Sacar una excepción', request: { params: IdParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});

export const adminBanIps = createRouter()
  .openapi(candidates, async (c) => {
    const p = c.req.valid('query');
    if (!p.player_id && !p.user_id) throw new AppError(400, 'VALIDATION_ERROR', 'Falta la ficha (`player_id`) o la cuenta (`user_id`).');
    const q = c.var.sb.rpc('admin_ban_ip_candidates' as never, { p_player: p.player_id ?? null, p_user: p.user_id ?? null } as never, { count: 'exact' });
    type Row = z.infer<typeof IpCandidateList>['items'][number];
    const { rows, total } = await runList<Row, typeof q>(q as never, p, {}, 'ip');
    return c.json(envelope(rows, total, p), 200);
  })
  .openapi(rangeAccounts, async (c) => {
    const p = c.req.valid('query');
    const q = c.var.sb.rpc('admin_ip_range_accounts' as never, { p_range: p.range } as never, { count: 'exact' });
    type Row = z.infer<typeof IpRangeAccountList>['items'][number];
    const { rows, total } = await runList<Row, typeof q>(q as never, p, {}, null);
    return c.json(envelope(rows, total, p), 200);
  })
  .openapi(banIps, async (c) => {
    const p = c.req.valid('query');
    const q = c.var.sb.rpc('admin_ban_ips' as never, { p_ban: c.req.valid('param').id } as never, { count: 'exact' });
    type Row = z.infer<typeof BanIpList>['items'][number];
    const { rows, total } = await runList<Row, typeof q>(q as never, p, {}, 'id');
    return c.json(envelope(rows, total, p), 200);
  })
  .openapi(setBanIps, async (c) => {
    const count = must(
      await c.var.sb.rpc('admin_ban_ips_set' as never, { p_ban: c.req.valid('param').id, p_ips: c.req.valid('json').ips } as never),
    ) as unknown as number;
    return c.json({ count }, 200);
  })
  .openapi(liftBanIp, async (c) => {
    must(await c.var.sb.rpc('admin_ban_ip_lift' as never, { p_id: c.req.valid('param').id } as never));
    return c.body(null, 204);
  })
  .openapi(addBanIp, async (c) => {
    const b = c.req.valid('json');
    const id = must(
      await c.var.sb.rpc('admin_ban_ip_add' as never, {
        p_ban: c.req.valid('param').id, p_ip: b.ip, p_except_players: b.except_players ?? [], p_except_users: b.except_users ?? [],
      } as never),
    ) as unknown as string;
    return c.json({ id }, 201);
  })
  .openapi(addException, async (c) => {
    const b = c.req.valid('json');
    const id = must(
      await c.var.sb.rpc('admin_ban_ip_exception_add' as never, { p_ban_ip: c.req.valid('param').id, p_player: b.player_id ?? null, p_user: b.user_id ?? null } as never),
    ) as unknown as string;
    return c.json({ id }, 201);
  })
  .openapi(removeException, async (c) => {
    must(await c.var.sb.rpc('admin_ban_ip_exception_remove' as never, { p_id: c.req.valid('param').id } as never));
    return c.body(null, 204);
  });
