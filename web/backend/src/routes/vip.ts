import { createRoute } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave, notFound, searchTerm } from '../lib/db';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { IdParam } from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';
import { AdminUserVip, AdminVipList, AdminVipQuery, VipGrant, VipRevoke } from '../schemas/vip';
import { toAdminVip, userExists, VIP_FIELDS, type VipRow, vipStatusOf } from '../services/vip';

// VIP, fase 0 (plan docs/bitacora/2026-10-28-vip-fase-0). Las reglas (solo admins, extender desde el fin actual, un
// temporal a un lifetime se rechaza) las valida la base: admin_vip_grant y admin_vip_revoke.

type C = Context<AppEnv>;

const list = createRoute({
  method: 'get', path: '/api/v1/admin/vips', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'VIP',
  description:
    'Las cuentas que fueron VIP alguna vez, con su estado. Por defecto, primero las que vencen antes (los lifetime y los que ' +
    'no están activos, al final). `expiring` deja los temporales activos que vencen en los próximos N días.',
  request: { query: AdminVipQuery },
  responses: { 200: { description: 'VIP', ...json(AdminVipList) }, ...errorResponses(400, 401, 403) },
});
const history = createRoute({
  method: 'get', path: '/api/v1/admin/users/{id}/vip', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'VIP de un usuario',
  description: 'Su estado y todos sus períodos: quién lo dio, la nota y, si se quitó, cuándo, quién y por qué.',
  request: { params: IdParam },
  responses: { 200: { description: 'VIP del usuario', ...json(AdminUserVip) }, ...errorResponses(400, 401, 403, 404) },
});
const grant = createRoute({
  method: 'post', path: '/api/v1/admin/users/{id}/vip', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Dar o extender el VIP',
  description:
    'Una duración: `months` (1, 3, 6 o 12), `until` (fecha de fin) o `lifetime`. Si ya es VIP, el período nuevo empieza donde ' +
    'termina el actual. A un lifetime no se le da un temporal (`BUSINESS_RULE`). Vence solo. Avisa a la cuenta.',
  request: { params: IdParam, body: { required: true, ...json(VipGrant) } },
  responses: { 200: { description: 'VIP del usuario', ...json(AdminUserVip) }, ...errorResponses(400, 401, 403, 404) },
});
const revoke = createRoute({
  method: 'post', path: '/api/v1/admin/users/{id}/vip/revoke', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Quitar el VIP',
  description: 'Revoca los períodos vigentes y los futuros, también un lifetime, con motivo. Sin VIP vigente: `BUSINESS_RULE`. Avisa a la cuenta.',
  request: { params: IdParam, body: { required: true, ...json(VipRevoke) } },
  responses: { 200: { description: 'VIP del usuario', ...json(AdminUserVip) }, ...errorResponses(400, 401, 403, 404) },
});

async function readUserVip(c: C, id: string) {
  const sb = c.var.sb;
  const [status, periods] = await Promise.all([
    vipStatusOf(sb, [id]),
    sb.from('vip_memberships')
      .select('id, starts_at, ends_at, source, note, granted_by, created_at, revoked_at, revoked_by, revoke_reason')
      .eq('user_id', id).order('created_at', { ascending: false }).order('starts_at', { ascending: false })
      .then(mustHave),
  ]);
  // profiles solo deja leer la cuenta propia: los alias de los admins salen de admin_user_list.
  const by = [...new Set(periods.flatMap((p) => [p.granted_by, p.revoked_by]).filter((x): x is string => !!x))];
  const aliases = new Map(
    by.length ? mustHave(await sb.from('admin_user_list').select('id, alias').in('id', by)).map((u) => [u.id!, u.alias ?? '']) : [],
  );
  const who = (u: string | null) => (u ? { id: u, alias: aliases.get(u) ?? '' } : null);
  return {
    vip: status.get(id) ?? null,
    periods: periods.map((p) => ({
      id: p.id,
      starts_at: p.starts_at,
      ends_at: p.ends_at,
      source: p.source as 'manual' | 'import',
      note: p.note,
      granted_by: who(p.granted_by),
      created_at: p.created_at,
      revoked: p.revoked_at ? { at: p.revoked_at, reason: p.revoke_reason, by: who(p.revoked_by) } : null,
    })),
  };
}

async function existing(c: C, id: string) {
  if (!(await userExists(c.var.sb, id))) throw notFound('ese usuario');
  return id;
}

export const vip = createRouter()
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('vip_status').select(VIP_FIELDS, { count: 'exact' });
    if (p.status) q = q.eq('status', p.status);
    const term = searchTerm(p.q);
    if (term) q = q.ilike('alias', `%${term}%`);
    if (p.expiring) q = q.eq('status', 'active').lte('until', new Date(Date.now() + p.expiring * 86_400_000).toISOString());
    const { rows, total } = await runList<VipRow, typeof q>(q, p, {}, 'user_id');
    return c.json(envelope(rows.map(toAdminVip), total, p), 200);
  })
  .openapi(history, async (c) => c.json(await readUserVip(c, await existing(c, c.req.valid('param').id)), 200))
  .openapi(grant, async (c) => {
    const id = await existing(c, c.req.valid('param').id);
    const b = c.req.valid('json');
    // La función recibe una sola duración: las otras van en null.
    must(
      await c.var.sb.rpc('admin_vip_grant', {
        p_user: id, p_months: (b.months ?? null) as number, p_until: (b.until ?? null) as string, p_lifetime: b.lifetime === true,
        p_note: (b.note || null) as string,
      }),
    );
    return c.json(await readUserVip(c, id), 200);
  })
  .openapi(revoke, async (c) => {
    const id = await existing(c, c.req.valid('param').id);
    must(await c.var.sb.rpc('admin_vip_revoke', { p_user: id, p_reason: c.req.valid('json').reason }));
    return c.json(await readUserVip(c, id), 200);
  });
