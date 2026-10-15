import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { requireAdmin, requireUser } from '../../src/lib/auth';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

const USER = '11111111-1111-4111-8111-111111111111';
let key: TestKey;
let impostor: TestKey; // mismo kid, otra clave privada

// Supabase simulado: JWKS, /auth/v1/user (fallback de getClaims) y PostgREST de profiles.
function fakeSupabase(opts: { role?: string | null } = {}) {
  const calls: { url: string; auth: string | null }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    calls.push({ url, auth: headers.get('authorization') });
    if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
    if (url.endsWith('/auth/v1/user')) return Response.json({ code: 401, msg: 'invalid JWT' }, { status: 401 });
    if (url.includes('/rest/v1/profiles')) {
      const rows = opts.role === null ? [] : [{ role: opts.role ?? 'user' }];
      return Response.json(rows, { headers: { 'content-range': `0-${rows.length - 1}/*` } });
    }
    return new Response('no simulado: ' + url, { status: 599 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

function appWithRoutes() {
  const app = makeApp();
  app.get('/yo', requireUser, (c) => c.json({ id: c.var.user.id, email: c.var.user.email }));
  app.get('/admin', requireUser, requireAdmin, (c) => c.json({ ok: true }));
  return app;
}

const get = (path: string, token?: string) =>
  appWithRoutes().request(path, token ? { headers: { Authorization: `Bearer ${token}` } } : {}, testEnv());

beforeAll(async () => {
  key = await makeKey();
  impostor = await makeKey(key.kid);
});
afterEach(() => vi.unstubAllGlobals());

describe('requireUser', () => {
  it('acepta un token válido y expone el usuario', async () => {
    fakeSupabase();
    const res = await get('/yo', await signToken(key, userClaims(USER)));
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ id: USER, email: `${USER}@test.local` });
  });

  it.each([
    ['sin header', undefined],
    ['sin "Bearer"', 'abc'],
  ])('401 %s', async (_t, header) => {
    fakeSupabase();
    const res = await appWithRoutes().request('/yo', header ? { headers: { Authorization: header } } : {}, testEnv());
    expect(res.status).toBe(401);
    expect((await json(res)).error.code).toBe('UNAUTHORIZED');
  });

  it('401 con un token vencido', async () => {
    fakeSupabase();
    const t = await signToken(key, userClaims(USER, { exp: Math.floor(Date.now() / 1000) - 10 }));
    expect((await get('/yo', t)).status).toBe(401);
  });

  it('401 con una firma de otra clave', async () => {
    fakeSupabase();
    expect((await get('/yo', await signToken(impostor, userClaims(USER)))).status).toBe(401);
  });

  it('401 con un token de rol anon (como la clave pública)', async () => {
    fakeSupabase();
    expect((await get('/yo', await signToken(key, { role: 'anon' }))).status).toBe(401);
  });

  it('401 con un token sin sub', async () => {
    fakeSupabase();
    expect((await get('/yo', await signToken(key, { role: 'authenticated' }))).status).toBe(401);
  });

  it('401 con un token adulterado (payload cambiado)', async () => {
    fakeSupabase();
    const [h, , s] = (await signToken(key, userClaims(USER))).split('.');
    const otro = Buffer.from(JSON.stringify(userClaims('otro-usuario'))).toString('base64url');
    expect((await get('/yo', `${h}.${otro}.${s}`)).status).toBe(401);
  });
});

describe('requireAdmin', () => {
  it('deja pasar a un admin y consulta profiles con el token del usuario', async () => {
    const calls = fakeSupabase({ role: 'admin' });
    const token = await signToken(key, userClaims(USER));
    const res = await get('/admin', token);
    expect(res.status).toBe(200);
    const q = calls.find((c) => c.url.includes('/rest/v1/profiles'));
    expect(q?.url).toContain(`id=eq.${USER}`);
    expect(q?.auth).toBe(`Bearer ${token}`);
  });

  it.each([
    ['rol user', 'user'],
    ['sin fila en profiles', null],
  ])('403 con %s', async (_t, role) => {
    fakeSupabase({ role });
    const res = await get('/admin', await signToken(key, userClaims(USER)));
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe('FORBIDDEN');
  });

  it('401 sin sesión (requireUser corta antes)', async () => {
    fakeSupabase({ role: 'admin' });
    expect((await get('/admin')).status).toBe(401);
  });
});
