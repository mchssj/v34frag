import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fromAuthError } from '../../src/lib/errors';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Casos que la Supabase local no reproduce (confirmación de email, errores raros de Auth): GoTrue simulado.
const USER = '22222222-2222-4222-8222-222222222222';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

type Route = (url: string, init: RequestInit) => Response | undefined;
function gotrue(route: Route) {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
    const r = route(url, init);
    if (r) return r;
    // El registro valida el alias antes: por defecto está libre.
    if (url.includes('/rest/v1/rpc/alias_check')) return Response.json('ok');
    return new Response('no simulado: ' + url, { status: 599 });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
const authError = (status: number, error_code: string, msg = error_code) =>
  Response.json({ code: status, error_code, msg }, { status });

const post = (path: string, body?: unknown, token?: string) =>
  makeApp().request(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    testEnv(),
  );

describe('POST /auth/signup', () => {
  it('con confirmación de email: session null y needsConfirmation, con el redirect al frontend', async () => {
    const fetch = gotrue((url) =>
      url.includes('/auth/v1/signup')
        ? Response.json({ id: USER, aud: 'authenticated', email: 'a@b.co', created_at: '2026-10-14T00:00:00Z' })
        : undefined,
    );
    const res = await post('/auth/signup', { email: 'a@b.co', password: 'secreta1', tag: 'Tag1' });
    expect(res.status).toBe(201);
    expect(await json(res)).toEqual({ session: null, needsConfirmation: true });
    const call = fetch.mock.calls.find(([u]) => String(u).includes('/auth/v1/signup'))!;
    expect(String(call[0])).toContain('redirect_to=https%3A%2F%2Fcsstv.pages.dev');
    expect(JSON.parse(String(call[1]?.body))).toMatchObject({ email: 'a@b.co', data: { tag: 'Tag1' } });
  });

  it.each([
    ['taken', 409, 'CONFLICT'],
    ['blocked', 400, 'VALIDATION_ERROR'],
  ])('alias %s: %i %s y no crea la cuenta', async (reason, status, code) => {
    const fetch = gotrue((url) => (url.includes('/rest/v1/rpc/alias_check') ? Response.json(reason) : undefined));
    const res = await post('/auth/signup', { email: 'a@b.co', password: 'secreta1', tag: 'Tag1' });
    expect(res.status).toBe(status);
    const body = await json(res);
    expect(body.error.code).toBe(code);
    expect(body.error.details).toEqual([{ path: 'tag', message: expect.any(String) }]);
    expect(fetch.mock.calls.some(([u]) => String(u).includes('/auth/v1/signup'))).toBe(false);
  });

  it('si set_my_tag falla después del registro, igual responde 201 y lo registra', async () => {
    const token = await signToken(key, userClaims(USER));
    gotrue((url) => {
      if (url.includes('/auth/v1/signup'))
        return Response.json({
          access_token: token,
          refresh_token: 'r1',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: { id: USER, aud: 'authenticated', email: 'a@b.co', created_at: '2026-10-14T00:00:00Z' },
        });
      if (url.includes('/rest/v1/rpc/set_my_tag')) return Response.json({ code: 'P0001', message: 'tag repetido' }, { status: 400 });
      if (url.includes('/rest/v1/profiles')) return Response.json([{ role: 'user', tag: 'Tag1' }]);
      return undefined;
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post('/auth/signup', { email: 'a@b.co', password: 'secreta1', tag: 'Tag1' });
    expect(res.status).toBe(201);
    expect((await json(res)).session.user).toMatchObject({ id: USER, tag: 'Tag1', role: 'user' });
    expect(String(log.mock.calls[0]?.[0])).toContain('set_my_tag');
  });

  it('429 si Supabase limita el envío de correos', async () => {
    gotrue((url) => (url.includes('/auth/v1/signup') ? authError(429, 'over_email_send_rate_limit') : undefined));
    const res = await post('/auth/signup', { email: 'a@b.co', password: 'secreta1', tag: 'Tag1' });
    expect(res.status).toBe(429);
  });
});

describe('POST /auth/login', () => {
  it('403 EMAIL_NOT_CONFIRMED si falta confirmar el correo', async () => {
    gotrue((url) => (url.includes('grant_type=password') ? authError(400, 'email_not_confirmed') : undefined));
    const res = await post('/auth/login', { email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe('EMAIL_NOT_CONFIRMED');
  });

  it('500 genérico ante un error desconocido de Auth, sin filtrar el detalle', async () => {
    gotrue((url) => (url.includes('grant_type=password') ? authError(500, 'unexpected_failure', 'db caída en 10.0.0.5') : undefined));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post('/auth/login', { email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await json(res))).not.toContain('10.0.0.5');
  });
});

describe('POST /auth/logout', () => {
  it('204 aunque Supabase diga que la sesión ya no existe', async () => {
    gotrue((url) => (url.includes('/auth/v1/logout') ? authError(404, 'session_not_found') : undefined));
    const res = await post('/auth/logout', undefined, await signToken(key, userClaims(USER)));
    expect(res.status).toBe(204);
  });

  it('500 si Supabase falla de verdad', async () => {
    gotrue((url) => (url.includes('/auth/v1/logout') ? new Response('caído', { status: 502 }) : undefined));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post('/auth/logout', undefined, await signToken(key, userClaims(USER)));
    expect(res.status).toBe(500);
  });
});

describe('GET /auth/me', () => {
  it('si el usuario fue borrado en Auth responde 401 aunque el token siga firmado', async () => {
    gotrue((url) => (url.endsWith('/auth/v1/user') ? authError(403, 'user_not_found') : undefined));
    const res = await makeApp().request(
      '/auth/me',
      { headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } },
      testEnv(),
    );
    expect(res.status).toBe(401);
  });

  it('si falla la actualización de last_seen, responde igual y solo lo registra', async () => {
    gotrue((url, init) => {
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: USER, aud: 'authenticated', email: 'a@b.co', created_at: '2026-01-01T00:00:00Z' });
      if (url.includes('/rest/v1/profile_details') && init.method === 'POST') return Response.json({ code: '42501', message: 'rls' }, { status: 403 });
      if (url.includes('/rest/v1/profiles')) return Response.json([{ role: 'admin', tag: 'Jefe' }]);
      return undefined;
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await makeApp().request(
      '/auth/me',
      { headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } },
      testEnv(),
    );
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ id: USER, role: 'admin', tag: 'Jefe', created_at: '2026-01-01T00:00:00Z' });
    await vi.waitFor(() => expect(String(log.mock.calls[0]?.[0])).toContain('last_seen'));
  });
});

describe('fromAuthError', () => {
  it.each([
    ['invalid_credentials', 401, 'INVALID_CREDENTIALS'],
    ['email_not_confirmed', 403, 'EMAIL_NOT_CONFIRMED'],
    ['user_already_exists', 409, 'CONFLICT'],
    ['email_exists', 409, 'CONFLICT'],
    ['weak_password', 400, 'VALIDATION_ERROR'],
    ['email_address_invalid', 400, 'VALIDATION_ERROR'],
    ['validation_failed', 400, 'VALIDATION_ERROR'],
    ['over_request_rate_limit', 429, 'RATE_LIMITED'],
    ['signup_disabled', 403, 'FORBIDDEN'],
    ['refresh_token_not_found', 401, 'UNAUTHORIZED'],
    ['refresh_token_already_used', 401, 'UNAUTHORIZED'],
    ['session_expired', 401, 'UNAUTHORIZED'],
    ['bad_jwt', 401, 'UNAUTHORIZED'],
  ])('%s → %i %s', (code, status, appCode) => {
    expect(fromAuthError({ code, message: 'x' })).toMatchObject({ status, code: appCode });
  });

  it('sin código conocido: 401/403 → UNAUTHORIZED, el resto → INTERNAL', () => {
    expect(fromAuthError({ status: 403, message: 'x' }).code).toBe('UNAUTHORIZED');
    expect(fromAuthError({ status: 500, message: 'x' }).code).toBe('INTERNAL');
  });
});

describe('POST /api/v1/me/password', () => {
  // GoTrue simulado: el login con la actual da una sesión nueva; `put` y `logout` responden lo que diga cada caso.
  async function cambio(opts: { put?: () => Response; logout?: () => Response; claims?: Record<string, unknown> } = {}) {
    const token = await signToken(key, userClaims(USER, opts.claims));
    const fresh = await signToken(key, userClaims(USER));
    const fetch = gotrue((url, init) => {
      if (url.includes('/auth/v1/user') && init.method === 'GET') return Response.json({ id: USER, aud: 'authenticated', email: 'de-auth@b.co' });
      if (url.includes('/auth/v1/token?grant_type=password'))
        return Response.json({
          access_token: fresh, refresh_token: 'r-nuevo', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
          user: { id: USER, aud: 'authenticated', email: 'a@b.co', created_at: '2026-10-14T00:00:00Z' },
        });
      if (url.includes('/auth/v1/user') && init.method === 'PUT') return opts.put?.() ?? Response.json({ id: USER });
      if (url.includes('/auth/v1/logout')) return opts.logout?.() ?? new Response(null, { status: 204 });
      if (url.includes('/rest/v1/profiles')) return Response.json([{ role: 'user', tag: 'Tag1' }]);
      return undefined;
    });
    const res = await post('/api/v1/me/password', { current_password: 'vieja-123', new_password: 'nueva-456' }, token);
    return { res, fetch, fresh };
  }

  it('usa la sesión nueva para cambiarla y cerrar las otras, y la devuelve', async () => {
    const { res, fetch, fresh } = await cambio();
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ refresh_token: 'r-nuevo', user: { id: USER } });
    const put = fetch.mock.calls.find(([u, i]) => String(u).includes('/auth/v1/user') && i?.method === 'PUT')!;
    expect(JSON.parse(String(put[1]?.body))).toEqual({ password: 'nueva-456' });
    expect((put[1]?.headers as Record<string, string>).Authorization).toBe(`Bearer ${fresh}`);
    const out = fetch.mock.calls.find(([u]) => String(u).includes('/auth/v1/logout'))!;
    expect(String(out[0])).toContain('scope=others');
  });

  it('si el token no trae el correo, lo pide a Auth', async () => {
    const { res, fetch } = await cambio({ claims: { email: undefined } });
    expect(res.status).toBe(200);
    const login = fetch.mock.calls.find(([u]) => String(u).includes('grant_type=password'))!;
    expect(JSON.parse(String(login[1]?.body))).toMatchObject({ email: 'de-auth@b.co', password: 'vieja-123' });
  });

  it.each([
    ['same_password', 'SAME_PASSWORD'],
    ['weak_password', 'VALIDATION_ERROR'],
  ])('Auth rechaza la nueva (%s): 400 %s', async (error_code, code) => {
    const { res } = await cambio({ put: () => authError(422, error_code) });
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe(code);
  });

  it('500 si Auth falla al cambiarla, sin cerrar las otras sesiones', async () => {
    const { res, fetch } = await cambio({ put: () => authError(500, 'unexpected_failure') });
    expect(res.status).toBe(500);
    expect(fetch.mock.calls.some(([u]) => String(u).includes('/auth/v1/logout'))).toBe(false);
  });

  it('si no se pueden cerrar las otras sesiones, la contraseña igual quedó cambiada: 200 y lo registra', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { res } = await cambio({ logout: () => new Response(null, { status: 500 }) });
    expect(res.status).toBe(200);
    expect(String(log.mock.calls[0]?.[0])).toContain('otras sesiones');
  });
});
