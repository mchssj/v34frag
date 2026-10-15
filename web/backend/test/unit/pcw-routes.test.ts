import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Formatos de PCW con PostgREST simulado (sin Docker).
const USER = '77777777-7777-4777-8777-777777777777';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null; auth: string | null };
type Handler = (url: URL, method: string) => Response | undefined;

function postgrest(handler: Handler) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const raw = String(input instanceof Request ? input.url : input);
      const method = (input instanceof Request ? input.method : init.method) ?? 'GET';
      const headers = new Headers(input instanceof Request ? input.headers : init.headers);
      calls.push({ method, url: decodeURIComponent(raw), body: typeof init.body === 'string' ? init.body : null, auth: headers.get('Authorization') });
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      return handler(new URL(raw), method) ?? new Response('no simulado: ' + raw, { status: 599 });
    }),
  );
  return calls;
}
const role = (r: 'admin' | 'user'): Handler => (url) => (url.pathname.endsWith('/profiles') ? Response.json([{ role: r }]) : undefined);

const put = async (body: unknown, token = true) =>
  makeApp().request(
    '/api/v1/admin/pcw/formats',
    {
      method: 'PUT',
      headers: { ...(token ? { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    testEnv(),
  );

describe('GET /api/v1/pcw/formats', () => {
  it('devuelve los formatos ordenados, sin sesión', async () => {
    const calls = postgrest((url) => (url.pathname.endsWith('/pcw_config') ? Response.json([{ best_of: [5, 1, 3] }]) : undefined));
    const res = await makeApp().request('/api/v1/pcw/formats', {}, testEnv());
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ formats: [1, 3, 5] });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const q = calls.find((c) => c.url.includes('/rest/v1/pcw_config'))!;
    expect(q.url).toContain('id=eq.1');
    expect(q.auth).toBe('Bearer anon-key-de-prueba-1234567890');
  });

  it('sin la fila de configuración: 500', async () => {
    postgrest((url) => (url.pathname.endsWith('/pcw_config') ? Response.json([]) : undefined));
    const res = await makeApp().request('/api/v1/pcw/formats', {}, testEnv());
    expect(res.status).toBe(500);
    expect((await json(res)).error.code).toBe('INTERNAL');
  });
});

describe('PUT /api/v1/admin/pcw/formats', () => {
  it('sin sesión: 401', async () => {
    postgrest(() => undefined);
    expect((await put({ formats: [1] }, false)).status).toBe(401);
  });

  it('un usuario común: 403 y no llama a la base', async () => {
    const calls = postgrest(role('user'));
    const res = await put({ formats: [1] });
    expect(res.status).toBe(403);
    expect(calls.some((c) => c.url.includes('/rpc/'))).toBe(false);
  });

  it.each([[{ formats: [] }], [{ formats: [2] }], [{ formats: [1, 3, 5, 1] }], [{}]])('cuerpo inválido %j: 400', async (body) => {
    postgrest(role('admin'));
    const res = await put(body);
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe('VALIDATION_ERROR');
  });

  it('admin: llama a set_pcw_formats y devuelve lo guardado', async () => {
    const calls = postgrest((url, m) => role('admin')(url, m) ?? (url.pathname.endsWith('/rpc/set_pcw_formats') ? Response.json([1, 3]) : undefined));
    const res = await put({ formats: [3, 1] });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ formats: [1, 3] });
    const rpc = calls.find((c) => c.url.includes('/rpc/set_pcw_formats'))!;
    expect(JSON.parse(rpc.body!)).toEqual({ p_best_of: [3, 1] });
  });

  it('error de la base (raise exception): 400 con su mensaje', async () => {
    postgrest((url, m) =>
      role('admin')(url, m) ??
      (url.pathname.endsWith('/rpc/set_pcw_formats')
        ? Response.json({ code: 'P0001', message: 'Tiene que quedar al menos un formato habilitado' }, { status: 400 })
        : undefined),
    );
    const res = await put({ formats: [1] });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatchObject({ code: 'BUSINESS_RULE', message: 'Tiene que quedar al menos un formato habilitado' });
  });
});
