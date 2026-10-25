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

// Catálogo de mapas (plan docs/bitacora/2026-10-25-pool-mapas-torneos-pcw).
describe('catálogo de mapas', () => {
  const POOL = [
    { name: 'de_a', mixes: true, veto_default: true },
    { name: 'de_b', mixes: true, veto_default: true },
    { name: 'de_c', mixes: false, veto_default: false },
  ];
  const admin = (extra: Handler = () => undefined): Handler => (url, method) =>
    role('admin')(url, method) ??
    extra(url, method) ??
    (url.pathname.endsWith('/map_pool') && method === 'GET' ? Response.json(POOL) : undefined) ??
    (url.pathname.endsWith('/map_pool') && method === 'POST' ? new Response(null, { status: 201 }) : undefined);
  const send = async (method: string, path: string, body?: unknown) =>
    makeApp().request(
      path,
      {
        method,
        headers: {
          Authorization: `Bearer ${await signToken(key, userClaims(USER))}`,
          ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
      },
      testEnv(),
    );
  const all = (over: Record<string, Record<string, unknown>> = {}) => POOL.map((m) => ({ name: m.name, active: true, ...over[m.name] }));

  it('listado: filtros de Mixes y pool por defecto, con la foto', async () => {
    const calls = postgrest((url) => (url.pathname.endsWith('/map_pool') ? Response.json([]) : undefined));
    expect((await makeApp().request('/api/v1/maps?mixes=true&veto_default=false', {}, testEnv())).status).toBe(200);
    const q = calls.find((c) => c.url.includes('/rest/v1/map_pool'))!.url;
    expect(q).toContain('mixes=eq.true');
    expect(q).toContain('veto_default=eq.false');
    expect(q).toContain('active=eq.true');
    expect(q).toContain('image_url');
  });

  it('PUT: conserva las marcas que no vienen y no borra', async () => {
    const calls = postgrest(admin());
    expect((await send('PUT', '/api/v1/admin/maps', { maps: all() })).status).toBe(204);
    const up = calls.find((c) => c.method === 'POST' && c.url.includes('/rest/v1/map_pool'))!;
    expect(JSON.parse(up.body!)).toEqual([
      { name: 'de_a', versions: ['de_a'], active: true, position: 1, mixes: true, veto_default: true },
      { name: 'de_b', versions: ['de_b'], active: true, position: 2, mixes: true, veto_default: true },
      { name: 'de_c', versions: ['de_c'], active: true, position: 3, mixes: false, veto_default: false },
    ]);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('PUT: falta un mapa, retirado en el pool por defecto o menos de 2 en el pool: 400', async () => {
    postgrest(admin());
    const missing = await send('PUT', '/api/v1/admin/maps', { maps: all().slice(0, 2) });
    expect(missing.status).toBe(400);
    expect((await json(missing)).error.message).toContain('Faltan: de_c');
    expect((await send('PUT', '/api/v1/admin/maps', { maps: all({ de_a: { active: false, veto_default: true } }) })).status).toBe(400);
    const one = await send('PUT', '/api/v1/admin/maps', { maps: all({ de_b: { veto_default: false } }) });
    expect((await json(one)).error.message).toBe('Tienen que quedar al menos 2 mapas en el pool por defecto.');
  });

  it('foto: mapa que no existe (404), no es una imagen (400) y más de 2 MB (413)', async () => {
    postgrest(admin((url) => (url.pathname.endsWith('/map_pool') && url.searchParams.get('name') === 'eq.de_x' ? Response.json([]) : undefined)));
    const fd = (f: File) => {
      const x = new FormData();
      x.append('file', f);
      return x;
    };
    const jpg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(16).fill(0)])], 'a.jpg');
    expect((await send('POST', '/api/v1/admin/maps/de_x/image', fd(jpg))).status).toBe(404);
    postgrest(admin((url) => (url.pathname.endsWith('/map_pool') ? Response.json({ image_url: null }) : undefined)));
    expect((await send('POST', '/api/v1/admin/maps/de_a/image', fd(new File([new TextEncoder().encode('GIF89a..........')], 'a.gif')))).status).toBe(400);
    expect((await send('POST', '/api/v1/admin/maps/de_a/image', fd(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'a.jpg')))).status).toBe(413);
  });
});
