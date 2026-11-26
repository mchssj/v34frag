import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Baneo por IP (replanteo 149, docs/bitacora/2026-11-26-baneo-por-ip) con PostgREST simulado. Las reglas (rangos,
// tope de 30 días, el freno en la cola) las prueba la base: pruebas/prueba_149.sql.
const USER = '77777777-7777-4777-8777-777777777777';
const BAN = '0b0b0b0b-0000-4000-8000-000000000001';
const PLAYER = 'dddddddd-0000-4000-8000-000000000001';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null; headers: Headers };
function postgrest(role: 'admin' | 'user', handler: (url: URL) => Response | undefined) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const raw = String(input instanceof Request ? input.url : input);
      const method = (input instanceof Request ? input.method : init.method) ?? 'GET';
      const headers = new Headers(input instanceof Request ? input.headers : init.headers);
      calls.push({ method, url: decodeURIComponent(raw), body: typeof init.body === 'string' ? init.body : null, headers });
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      const url = new URL(raw);
      if (url.pathname.endsWith('/profiles') && url.searchParams.get('select') === 'role') return Response.json([{ role }]);
      return handler(url) ?? new Response('no simulado: ' + raw, { status: 599 });
    }),
  );
  return calls;
}
const call = async (method: string, path: string, body?: unknown, env = testEnv(), extra: Record<string, string> = {}) =>
  makeApp().request(
    path,
    {
      method,
      headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json', ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
const counted = (rows: unknown[], total = rows.length) =>
  Response.json(rows, { headers: { 'Content-Range': `0-${Math.max(rows.length - 1, 0)}/${total}` } });

describe('la IP real viaja a la base', () => {
  it('con CLIENT_IP_HEADER, los pedidos a la base llevan X-Forwarded-For con la IP del usuario', async () => {
    const calls = postgrest('admin', (url) => (url.pathname.endsWith('/rpc/admin_ban_ips') ? counted([]) : undefined));
    const res = await call('GET', `/api/v1/admin/bans/${BAN}/ips`, undefined, testEnv({ CLIENT_IP_HEADER: 'x-forwarded-for' }), {
      'x-forwarded-for': '203.0.113.7',
    });
    expect(res.status).toBe(200);
    const rpc = calls.find((x) => x.url.includes('/rpc/admin_ban_ips'))!;
    expect(rpc.headers.get('x-forwarded-for')).toBe('203.0.113.7');
  });

  it('sin CLIENT_IP_HEADER no manda ninguna', async () => {
    const calls = postgrest('admin', (url) => (url.pathname.endsWith('/rpc/admin_ban_ips') ? counted([]) : undefined));
    await call('GET', `/api/v1/admin/bans/${BAN}/ips`, undefined, testEnv(), { 'x-forwarded-for': '203.0.113.7' });
    expect(calls.find((x) => x.url.includes('/rpc/admin_ban_ips'))!.headers.get('x-forwarded-for')).toBeNull();
  });
});

describe('rutas de admin', () => {
  it('candidatos: pide la ficha o la cuenta', async () => {
    postgrest('admin', () => undefined);
    expect((await call('GET', '/api/v1/admin/ip-candidates')).status).toBe(400);
    const row = { ip: '203.0.113.7', sources: ['web'], first_seen_at: '2026-11-26T00:00:00Z', last_seen_at: '2026-11-26T01:00:00Z', others: [{ player_id: null, alias: 'Otra' }], banned: false };
    const calls = postgrest('admin', (url) => (url.pathname.endsWith('/rpc/admin_ban_ip_candidates') ? counted([row]) : undefined));
    const res = await call('GET', `/api/v1/admin/ip-candidates?player_id=${PLAYER}`);
    expect(res.status).toBe(200);
    expect((await json(res)).items[0].others[0].alias).toBe('Otra');
    expect(JSON.parse(calls.find((x) => x.url.includes('/rpc/admin_ban_ip_candidates'))!.body!)).toEqual({ p_player: PLAYER, p_user: null });
  });

  it('a quién afecta un rango', async () => {
    const calls = postgrest('admin', (url) =>
      url.pathname.endsWith('/rpc/admin_ip_range_accounts')
        ? counted([{ player_id: PLAYER, alias: 'Jugador', sources: ['servidor'], ips: 2, last_seen_at: '2026-11-26T00:00:00Z' }])
        : undefined,
    );
    const res = await call('GET', '/api/v1/admin/ip-ranges/accounts?range=181.45.0.0/16');
    expect(res.status).toBe(200);
    expect((await json(res)).items[0].ips).toBe(2);
    expect(JSON.parse(calls.find((x) => x.url.includes('/rpc/admin_ip_range_accounts'))!.body!)).toEqual({ p_range: '181.45.0.0/16' });
  });

  it('banear IPs y rangos: el rango demasiado grande llega como 400 con el mensaje de la base', async () => {
    const calls = postgrest('admin', (url) => (url.pathname.endsWith('/rpc/admin_ban_ips_set') ? Response.json(2) : undefined));
    const res = await call('PUT', `/api/v1/admin/bans/${BAN}/ips`, { ips: ['203.0.113.7', '181.45.10.0/24'] });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ count: 2 });
    expect(JSON.parse(calls.find((x) => x.url.includes('/rpc/admin_ban_ips_set'))!.body!)).toEqual({ p_ban: BAN, p_ips: ['203.0.113.7', '181.45.10.0/24'] });

    postgrest('admin', (url) =>
      url.pathname.endsWith('/rpc/admin_ban_ips_set')
        ? Response.json({ code: 'P0001', message: 'Rango demasiado grande: 10.0.0.0/8. Como mucho /16 en IPv4 (x.y.*.*) o /32 en IPv6', details: null, hint: null }, { status: 400 })
        : undefined,
    );
    const bad = await call('PUT', `/api/v1/admin/bans/${BAN}/ips`, { ips: ['10.0.0.0/8'] });
    expect(bad.status).toBe(400);
    expect((await json(bad)).error.message).toContain('demasiado grande');
  });

  it('levantar una IP: 204', async () => {
    postgrest('admin', (url) => (url.pathname.endsWith('/rpc/admin_ban_ip_lift') ? new Response(null, { status: 204 }) : undefined));
    expect((await call('DELETE', `/api/v1/admin/ban-ips/${BAN}`)).status).toBe(204);
  });

  it('solo admins', async () => {
    postgrest('user', () => undefined);
    expect((await call('GET', `/api/v1/admin/ip-candidates?player_id=${PLAYER}`)).status).toBe(403);
  });
});
