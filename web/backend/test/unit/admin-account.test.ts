import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomPassword } from '../../src/lib/password';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const base = `/api/v1/admin/users/${USER}`;
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => vi.unstubAllGlobals());

type Route = (url: string, init: RequestInit) => Response | undefined;
function backend(route: Route, role = 'admin') {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
    if (url.includes('/rest/v1/profiles')) return Response.json({ role });
    return route(url, init) ?? new Response('no simulado: ' + url, { status: 599 });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
const pgError = (status: number, code: string, message: string) =>
  Response.json({ code, message, details: null, hint: null }, { status });
const call = async (path: string, method = 'POST', env = {}) =>
  makeApp().request(path, { method, headers: { Authorization: `Bearer ${await signToken(key, userClaims(ADMIN))}` } }, testEnv(env));
const SERVICE = { SUPABASE_SERVICE_KEY: 'clave-de-administrador-de-prueba' };
const called = (fn: ReturnType<typeof backend>, part: string) =>
  fn.mock.calls.filter(([u]) => String(u instanceof Request ? u.url : u).includes(part));

describe('randomPassword', () => {
  it('tiene el largo pedido, sin caracteres confusos y no se repite', () => {
    const a = randomPassword();
    expect(a).toMatch(/^[a-km-np-zA-HJ-NP-Z2-9]{16}$/);
    expect(randomPassword()).not.toBe(a);
  });
});

describe('acciones de cuenta', () => {
  it('un moderador no puede usar ninguna', async () => {
    const fn = backend(() => undefined, 'moderator');
    for (const p of ['resend-confirmation', 'send-password-reset', 'random-password']) {
      expect((await call(`${base}/${p}`, 'POST', SERVICE)).status).toBe(403);
    }
    expect(called(fn, '/rest/v1/rpc/').length).toBe(0);
    expect(called(fn, '/auth/v1/admin').length).toBe(0);
  });

  it('el estado de la cuenta', async () => {
    backend((u) => (u.includes('rpc/admin_account_status') ? Response.json({ confirmed: false, last_sign_in_at: null }) : undefined));
    const res = await call(`${base}/account`, 'GET');
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ confirmed: false, last_sign_in_at: null });
  });

  it('reenvía la activación al correo de la cuenta', async () => {
    const fn = backend((u) => {
      if (u.includes('rpc/admin_account_action')) return Response.json({ email: 'a@b.co' });
      if (u.includes('/auth/v1/resend')) return Response.json({});
      return undefined;
    });
    expect((await call(`${base}/resend-confirmation`)).status).toBe(204);
    const [, init] = called(fn, '/auth/v1/resend')[0]!;
    expect(JSON.parse(String(init!.body))).toMatchObject({ type: 'signup', email: 'a@b.co' });
  });

  it('una cuenta ya confirmada da 409 y no se envía nada', async () => {
    const fn = backend((u) => (u.includes('rpc/admin_account_action') ? pgError(409, '23505', 'Esa cuenta ya confirmó su correo.') : undefined));
    expect((await call(`${base}/resend-confirmation`)).status).toBe(409);
    expect(called(fn, '/auth/v1/resend').length).toBe(0);
  });

  it('envía el correo de contraseña con el link a la web', async () => {
    const fn = backend((u) => {
      if (u.includes('rpc/admin_account_action')) return Response.json({ email: 'a@b.co' });
      if (u.includes('/auth/v1/recover')) return Response.json({});
      return undefined;
    });
    expect((await call(`${base}/send-password-reset`)).status).toBe(204);
    expect(String(called(fn, '/auth/v1/recover')[0]![0])).toContain(encodeURIComponent('https://csstv.pages.dev/reset-password'));
  });

  it('el límite de correos de GoTrue llega como 429', async () => {
    backend((u) => {
      if (u.includes('rpc/admin_account_action')) return Response.json({ email: 'a@b.co' });
      if (u.includes('/auth/v1/recover')) return Response.json({ code: 429, error_code: 'over_email_send_rate_limit', msg: 'x' }, { status: 429 });
      return undefined;
    });
    expect((await call(`${base}/send-password-reset`)).status).toBe(429);
  });

  it('la aleatoria usa la clave de administrador, cierra sesiones y no se guarda en caché', async () => {
    const fn = backend((u) => {
      if (u.includes('rpc/admin_account_action')) return Response.json({ email: 'a@b.co' });
      if (u.includes(`/auth/v1/admin/users/${USER}`)) return Response.json({ id: USER });
      if (u.includes('rpc/admin_account_close_sessions')) return new Response(null, { status: 204 });
      return undefined;
    });
    const res = await call(`${base}/random-password`, 'POST', SERVICE);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await json(res);
    expect(body.password).toHaveLength(16);
    expect(body.sessions_closed).toBe(true);
    const [, init] = called(fn, `/auth/v1/admin/users/${USER}`)[0]!;
    expect(new Headers(init!.headers).get('apikey')).toBe(SERVICE.SUPABASE_SERVICE_KEY);
    expect(JSON.parse(String(init!.body)).password).toBe(body.password);
    expect(called(fn, 'rpc/admin_account_close_sessions').length).toBe(1);
  });

  it('la regla de la base (cuenta propia u otro admin) corta antes de cambiar nada', async () => {
    const fn = backend((u) => (u.includes('rpc/admin_account_action') ? pgError(403, '42501', 'No se le puede cambiar la contraseña a otro admin.') : undefined));
    expect((await call(`${base}/random-password`, 'POST', SERVICE)).status).toBe(403);
    expect(called(fn, '/auth/v1/admin').length).toBe(0);
  });

  it('sin la clave de administrador responde 501 y no registra nada', async () => {
    const fn = backend(() => undefined);
    expect((await call(`${base}/random-password`)).status).toBe(501);
    expect(called(fn, 'rpc/admin_account_action').length).toBe(0);
  });

  it('si no se pudieron cerrar las sesiones, entrega igual la contraseña y lo avisa', async () => {
    backend((u) => {
      if (u.includes('rpc/admin_account_action')) return Response.json({ email: 'a@b.co' });
      if (u.includes(`/auth/v1/admin/users/${USER}`)) return Response.json({ id: USER });
      if (u.includes('rpc/admin_account_close_sessions')) return pgError(500, 'XX000', 'falló');
      return undefined;
    });
    const res = await call(`${base}/random-password`, 'POST', SERVICE);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.sessions_closed).toBe(false);
    expect(body.password).toHaveLength(16);
  });
});
