import { createRoute } from '@hono/zod-openapi';
import { requireAdmin, requireUser } from '../lib/auth';
import { mustHave, searchTerm } from '../lib/db';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import {
  EmailDomain,
  EmailDomainAccountList,
  EmailDomainAccountQuery,
  EmailDomainBody,
  EmailDomainList,
  EmailDomainParam,
  EmailDomainQuery,
  EmailDomainUnblocked,
} from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';

// Correos temporales bloqueados al registrarse (replanteo 148, plan docs/bitacora/2026-11-26-correos-bloqueados).
// Solo admins. El bloqueo en sí lo hace la base (trigger en auth.users); esto es la lista.

const COLS = 'domain, source, blocked, reason, created_at, updated_at';

const list = createRoute({
  method: 'get', path: '/api/v1/admin/email-domains', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Dominios de correo bloqueados',
  description: 'La lista pública de correos temporales y los que agregaron los admins, con las excepciones (`blocked: false`).',
  request: { query: EmailDomainQuery },
  responses: { 200: { description: 'Dominios', ...json(EmailDomainList) }, ...errorResponses(400, 401, 403) },
});
const block = createRoute({
  method: 'post', path: '/api/v1/admin/email-domains', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Bloquear un dominio de correo',
  description: 'Desde ese momento no se puede registrar ni cambiar el correo a uno de ese dominio ni de sus subdominios. Si era una excepción, se vuelve a bloquear.',
  request: { body: { required: true, ...json(EmailDomainBody) } },
  responses: { 201: { description: 'Bloqueado', ...json(EmailDomain) }, ...errorResponses(400, 401, 403) },
});
const unblock = createRoute({
  method: 'delete', path: '/api/v1/admin/email-domains/{domain}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Desbloquear un dominio de correo',
  description: 'Uno agregado por un admin se borra. Uno de la lista pública queda como excepción, para que una carga nueva de la lista no lo vuelva a bloquear.',
  request: { params: EmailDomainParam },
  responses: { 200: { description: 'Desbloqueado', ...json(EmailDomainUnblocked) }, ...errorResponses(400, 401, 403, 404) },
});
const accounts = createRoute({
  method: 'get', path: '/api/v1/admin/email-domains/accounts', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cuentas que ya usan un dominio bloqueado',
  description: 'Se crearon antes del bloqueo y no se tocan: un admin decide si banea su ficha.',
  request: { query: EmailDomainAccountQuery },
  responses: { 200: { description: 'Cuentas', ...json(EmailDomainAccountList) }, ...errorResponses(400, 401, 403) },
});

export const adminEmailDomains = createRouter()
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('email_domain_blocks' as never).select(COLS, { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.ilike('domain', `%${term.replace(/ /g, '')}%`);
    if (p.source) q = q.eq('source', p.source);
    if (p.blocked !== undefined) q = q.eq('blocked', p.blocked);
    type Row = { domain: string; source: 'lista' | 'admin'; blocked: boolean; reason: string | null; created_at: string; updated_at: string };
    const { rows, total } = await runList<Row, typeof q>(q, p, {}, 'domain');
    return c.json(envelope(rows, total, p), 200);
  })
  .openapi(block, async (c) => {
    const { domain, reason } = c.req.valid('json');
    const row = mustHave(await c.var.sb.rpc('admin_email_domain_block' as never, { p_domain: domain, p_reason: reason ?? null } as never)) as {
      domain: string; source: 'lista' | 'admin'; blocked: boolean; reason: string | null; created_at: string; updated_at: string;
    };
    return c.json(row, 201);
  })
  .openapi(unblock, async (c) => {
    const r = mustHave(await c.var.sb.rpc('admin_email_domain_unblock' as never, { p_domain: c.req.valid('param').domain } as never)) as unknown as {
      domain: string; removed: boolean;
    };
    return c.json(r, 200);
  })
  .openapi(accounts, async (c) => {
    const p = c.req.valid('query');
    const q = c.var.sb.rpc('admin_email_domain_accounts' as never, {} as never, { count: 'exact' });
    type Row = { user_id: string; email: string; alias: string | null; domain: string; created_at: string; confirmed: boolean; player_id: string | null; banned: boolean };
    const { rows, total } = await runList<Row, typeof q>(q as never, p, {}, 'user_id');
    return c.json(envelope(rows, total, p), 200);
  });
