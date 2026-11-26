import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { EmailDomainBody } from '../../src/schemas/admin';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Correos temporales bloqueados (replanteo 148, docs/bitacora/2026-11-26-correos-bloqueados) con PostgREST simulado.
// Las reglas (subdominios, excepciones, trigger, permisos) las prueba la base: pruebas/prueba_148.sql.
const USER = '77777777-7777-4777-8777-777777777777';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null };
function postgrest(role: 'admin' | 'user', handler: (url: URL, method: string) => Response | undefined) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const raw = String(input instanceof Request ? input.url : input);
      const method = (input instanceof Request ? input.method : init.method) ?? 'GET';
      calls.push({ method, url: decodeURIComponent(raw), body: typeof init.body === 'string' ? init.body : null });
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      const url = new URL(raw);
      if (url.pathname.endsWith('/profiles') && url.searchParams.get('select') === 'role') return Response.json([{ role }]);
      return handler(url, method) ?? new Response('no simulado: ' + raw, { status: 599 });
    }),
  );
  return calls;
}
const call = async (method: string, path: string, body?: unknown) =>
  makeApp().request(
    path,
    {
      method,
      headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    testEnv(),
  );
const row = (o: Record<string, unknown> = {}) => ({
  domain: 'anonmart.com', source: 'admin', blocked: true, reason: 'Cheater', created_at: '2026-11-26T00:00:00Z',
  updated_at: '2026-11-26T00:00:00Z', ...o,
});
const counted = (rows: unknown[], total = rows.length) =>
  Response.json(rows, { headers: { 'Content-Range': `0-${Math.max(rows.length - 1, 0)}/${total}` } });

describe('esquemas', () => {
  it('el dominio: de 3 a 260 caracteres, recortado', () => {
    expect(EmailDomainBody.safeParse({ domain: ' anonmart.com ' }).data?.domain).toBe('anonmart.com');
    expect(EmailDomainBody.safeParse({ domain: 'ab' }).success).toBe(false);
    expect(EmailDomainBody.safeParse({ domain: 'anonmart.com', reason: 'x'.repeat(201) }).success).toBe(false);
  });
});

describe('GET /api/v1/admin/email-domains', () => {
  it('filtra por texto, origen y estado, ordena y pagina en la base', async () => {
    const calls = postgrest('admin', (url) => (url.pathname.endsWith('/email_domain_blocks') ? counted([row()], 7) : undefined));
    const res = await call('GET', '/api/v1/admin/email-domains?q=anon&source=lista&blocked=false&sort=updated_at&order=desc&per=5');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({ total: 7, per: 5, sort: 'updated_at', order: 'desc' });
    expect(body.items[0].domain).toBe('anonmart.com');
    const u = calls.find((x) => x.url.includes('/email_domain_blocks'))!.url;
    expect(u).toContain('domain=ilike.%anon%');
    expect(u).toContain('source=eq.lista');
    expect(u).toContain('blocked=eq.false');
    expect(u).toContain('order=updated_at.desc.nullslast,domain.asc');
  });

  it('solo admins: 403 para un usuario', async () => {
    postgrest('user', () => undefined);
    const res = await call('GET', '/api/v1/admin/email-domains');
    expect(res.status).toBe(403);
  });
});

describe('bloquear y desbloquear', () => {
  it('POST manda el dominio y el motivo a admin_email_domain_block', async () => {
    const calls = postgrest('admin', (url) => (url.pathname.endsWith('/rpc/admin_email_domain_block') ? Response.json(row()) : undefined));
    const res = await call('POST', '/api/v1/admin/email-domains', { domain: '@AnonMart.com', reason: 'Cheater' });
    expect(res.status).toBe(201);
    expect((await json(res)).domain).toBe('anonmart.com');
    const rpc = calls.find((x) => x.url.includes('/rpc/admin_email_domain_block'))!;
    expect(JSON.parse(rpc.body!)).toEqual({ p_domain: '@AnonMart.com', p_reason: 'Cheater' });
  });

  it('un dominio inválido: el mensaje de la base llega como 400', async () => {
    postgrest('admin', (url) =>
      url.pathname.endsWith('/rpc/admin_email_domain_block')
        ? Response.json({ code: 'P0001', message: 'Ese dominio no es válido. Escríbelo como anonmart.com', details: null, hint: null }, { status: 400 })
        : undefined,
    );
    const res = await call('POST', '/api/v1/admin/email-domains', { domain: 'no valido' });
    expect(res.status).toBe(400);
    expect((await json(res)).error.message).toContain('no es válido');
  });

  it('DELETE: de la lista queda como excepción; si no está, 404', async () => {
    const calls = postgrest('admin', (url) =>
      url.pathname.endsWith('/rpc/admin_email_domain_unblock') ? Response.json({ domain: 'mailinator.com', removed: false }) : undefined,
    );
    const res = await call('DELETE', '/api/v1/admin/email-domains/mailinator.com');
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ domain: 'mailinator.com', removed: false });
    expect(JSON.parse(calls.find((x) => x.url.includes('/rpc/admin_email_domain_unblock'))!.body!)).toEqual({ p_domain: 'mailinator.com' });

    postgrest('admin', (url) =>
      url.pathname.endsWith('/rpc/admin_email_domain_unblock')
        ? Response.json({ code: 'P0002', message: 'Ese dominio no está en la lista', details: null, hint: null }, { status: 400 })
        : undefined,
    );
    expect((await call('DELETE', '/api/v1/admin/email-domains/otro.com')).status).toBe(404);
  });
});

describe('GET /api/v1/admin/email-domains/accounts', () => {
  it('las cuentas que ya usan un dominio bloqueado, paginadas', async () => {
    const acc = { user_id: USER, email: 'x@anonmart.com', alias: 'Cheat', domain: 'anonmart.com', created_at: '2026-11-20T00:00:00Z', confirmed: true, player_id: null, banned: false };
    const calls = postgrest('admin', (url) => (url.pathname.endsWith('/rpc/admin_email_domain_accounts') ? counted([acc], 6) : undefined));
    const res = await call('GET', '/api/v1/admin/email-domains/accounts?per=10');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.total).toBe(6);
    expect(body.items[0].email).toBe('x@anonmart.com');
    expect(calls.find((x) => x.url.includes('/rpc/admin_email_domain_accounts'))!.url).toContain('order=created_at.desc.nullslast,user_id.asc');
  });
});
