import { createRoute, z } from '@hono/zod-openapi';
import { requireAdmin, requireUser } from '../lib/auth';
import { must } from '../lib/db';
import { AppError } from '../lib/errors';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import {
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
  });
