import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { VipGrant } from '../../src/schemas/vip';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// VIP (plan docs/bitacora/2026-10-28-vip-fase-0) con PostgREST simulado (sin Docker). Las reglas (solo admins, extender
// desde el fin actual, un temporal a un lifetime) las prueba la base: pruebas/32_vip.sql y vip_produccion.sql.
const USER = '77777777-7777-4777-8777-777777777777';
const TARGET = '88888888-8888-4888-8888-888888888888';
const PLAYER = 'dddddddd-0000-4000-8000-000000000001';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null };
function postgrest(role: 'admin' | 'user', handler: (url: URL) => Response | undefined) {
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
      return handler(url) ?? new Response('no simulado: ' + raw, { status: 599 });
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

const status = (o: Record<string, unknown> = {}) => ({
  user_id: TARGET, alias: 'Vip', player_id: PLAYER, photo_url: null, status: 'active', active: true, lifetime: false,
  until: '2026-12-01T00:00:00Z', since: '2026-10-01T00:00:00Z', last_change: '2026-10-01T00:00:00Z', ...o,
});
const period = (o: Record<string, unknown> = {}) => ({
  id: '0c0c0c0c-0000-4000-8000-000000000001', starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-12-01T00:00:00Z', source: 'manual',
  note: 'pagó', granted_by: USER, created_at: '2026-10-01T00:00:00Z', revoked_at: null, revoked_by: null, revoke_reason: null, ...o,
});
// Cuenta existente, su estado y sus períodos, y los RPC.
const world = (o: { exists?: boolean; status?: unknown[]; periods?: unknown[]; rpc?: Response } = {}) => (url: URL) => {
  const p = url.pathname;
  if (p.endsWith('/admin_user_list') && url.searchParams.get('select') === 'id') return Response.json(o.exists === false ? [] : [{ id: TARGET }]);
  if (p.endsWith('/admin_user_list')) return Response.json([{ id: USER, alias: 'Kyan' }]);
  if (p.endsWith('/vip_status')) return Response.json(o.status ?? [status()]);
  if (p.endsWith('/vip_memberships')) return Response.json(o.periods ?? [period()]);
  if (p.includes('/rpc/')) return o.rpc ?? Response.json('0c0c0c0c-0000-4000-8000-000000000001');
  return undefined;
};
const rpcBody = (calls: Call[], fn: string) => JSON.parse(calls.find((x) => x.url.includes(`/rpc/${fn}`))!.body!);

describe('esquema', () => {
  it('dar: una sola duración (1, 3, 6 o 12 meses, una fecha o lifetime)', () => {
    expect(VipGrant.safeParse({ months: 3 }).success).toBe(true);
    expect(VipGrant.safeParse({ until: '2026-12-01T00:00:00Z' }).success).toBe(true);
    expect(VipGrant.safeParse({ lifetime: true, note: 'apoyo' }).success).toBe(true);
    expect(VipGrant.safeParse({}).success).toBe(false);
    expect(VipGrant.safeParse({ months: 2 }).success).toBe(false);
    expect(VipGrant.safeParse({ months: 1, lifetime: true }).success).toBe(false);
    expect(VipGrant.safeParse({ lifetime: false }).success).toBe(false);
    expect(VipGrant.safeParse({ months: 1, note: 'x'.repeat(201) }).success).toBe(false);
  });
});

describe('admin', () => {
  it('solo admins', async () => {
    postgrest('user', world());
    expect((await call('GET', '/api/v1/admin/vips')).status).toBe(403);
    expect((await call('POST', `/api/v1/admin/users/${TARGET}/vip`, { months: 1 })).status).toBe(403);
  });

  it('lista: filtros, orden por vencimiento y la ficha', async () => {
    const calls = postgrest('admin', world());
    const res = await call('GET', '/api/v1/admin/vips?status=active&q=Vi&expiring=7');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.items[0]).toEqual({
      user: { id: TARGET, alias: 'Vip' }, player: { id: PLAYER, photo_url: null }, status: 'active', active: true, lifetime: false,
      until: '2026-12-01T00:00:00Z', since: '2026-10-01T00:00:00Z', last_change: '2026-10-01T00:00:00Z',
    });
    const url = calls.find((c) => c.url.includes('/rest/v1/vip_status'))!.url;
    expect(url).toContain('status=eq.active');
    expect(url).toContain('alias=ilike.%vi%');
    expect(url).toContain('until=lte.');
    expect(url).toContain('order=until.asc.nullslast,user_id.asc');
  });

  it('historial: el estado y los períodos, con el alias de quién lo dio y quién lo quitó', async () => {
    postgrest('admin', world({ periods: [period({ revoked_at: '2026-10-20T00:00:00Z', revoked_by: USER, revoke_reason: 'baneado' })] }));
    const body = await json(await call('GET', `/api/v1/admin/users/${TARGET}/vip`));
    expect(body.vip).toEqual({ active: true, lifetime: false, until: '2026-12-01T00:00:00Z', since: '2026-10-01T00:00:00Z' });
    expect(body.periods[0]).toMatchObject({
      granted_by: { id: USER, alias: 'Kyan' }, revoked: { at: '2026-10-20T00:00:00Z', reason: 'baneado', by: { id: USER, alias: 'Kyan' } },
    });
  });

  it('historial de alguien que nunca fue VIP: vip null y sin períodos', async () => {
    postgrest('admin', world({ status: [], periods: [] }));
    expect(await json(await call('GET', `/api/v1/admin/users/${TARGET}/vip`))).toEqual({ vip: null, periods: [] });
  });

  it('cuenta que no existe: 404 sin llamar a la base', async () => {
    const calls = postgrest('admin', world({ exists: false }));
    expect((await call('POST', `/api/v1/admin/users/${TARGET}/vip`, { months: 1 })).status).toBe(404);
    expect(calls.some((c) => c.url.includes('/rpc/'))).toBe(false);
  });

  it('dar: una duración y las otras en null', async () => {
    const calls = postgrest('admin', world());
    expect((await call('POST', `/api/v1/admin/users/${TARGET}/vip`, { months: 3, note: ' pagó ' })).status).toBe(200);
    expect(rpcBody(calls, 'admin_vip_grant')).toEqual({ p_user: TARGET, p_months: 3, p_until: null, p_lifetime: false, p_note: 'pagó' });
    await call('POST', `/api/v1/admin/users/${TARGET}/vip`, { lifetime: true });
    expect(JSON.parse(calls.filter((c) => c.url.includes('/rpc/admin_vip_grant')).at(-1)!.body!)).toEqual({
      p_user: TARGET, p_months: null, p_until: null, p_lifetime: true, p_note: null,
    });
  });

  it('una regla de la base es BUSINESS_RULE', async () => {
    postgrest('admin', world({ rpc: Response.json({ code: 'P0001', message: 'Ya es VIP lifetime' }, { status: 400 }) }));
    const res = await call('POST', `/api/v1/admin/users/${TARGET}/vip`, { months: 1 });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatchObject({ code: 'BUSINESS_RULE', message: 'Ya es VIP lifetime' });
  });

  it('quitar: con motivo', async () => {
    const calls = postgrest('admin', world());
    expect((await call('POST', `/api/v1/admin/users/${TARGET}/vip/revoke`, { reason: '  ' })).status).toBe(400);
    expect((await call('POST', `/api/v1/admin/users/${TARGET}/vip/revoke`, { reason: 'baneado' })).status).toBe(200);
    expect(rpcBody(calls, 'admin_vip_revoke')).toEqual({ p_user: TARGET, p_reason: 'baneado' });
  });
});
