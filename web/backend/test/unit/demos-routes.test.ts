import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { WorkerPatch, WorkerRotate } from '../../src/schemas/demos';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Demos desde el admin con PostgREST simulado (sin Docker).
const USER = '77777777-7777-4777-8777-777777777777';
const WID = '22222222-2222-4222-8222-222222222222';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null };
function postgrest(handler: (url: URL, method: string) => Response | undefined) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const raw = String(input instanceof Request ? input.url : input);
      const method = (input instanceof Request ? input.method : init.method) ?? 'GET';
      calls.push({ method, url: decodeURIComponent(raw), body: typeof init.body === 'string' ? init.body : null });
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      const url = new URL(raw);
      if (url.pathname.endsWith('/profiles')) return Response.json([{ role: 'admin' }]);
      return handler(url, method) ?? new Response('no simulado: ' + raw, { status: 599 });
    }),
  );
  return calls;
}
const call = async (method: string, path: string, body?: unknown, env = testEnv()) =>
  makeApp().request(
    path,
    {
      method,
      headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );

describe('esquemas', () => {
  it('editar un Worker pide algo', () => {
    expect(WorkerPatch.safeParse({}).success).toBe(false);
    expect(WorkerPatch.safeParse({ active: false }).success).toBe(true);
    expect(WorkerPatch.safeParse({ name: 'a' }).success).toBe(false);
  });
  it('token nuevo pide "estoy seguro"', () => {
    expect(WorkerRotate.safeParse({}).success).toBe(false);
    expect(WorkerRotate.safeParse({ confirm: 'seguro' }).success).toBe(false);
    expect(WorkerRotate.safeParse({ confirm: ' ESTOY SEGURO ' }).success).toBe(true);
  });
});

describe('rutas', () => {
  it('resumen sin fila: ceros', async () => {
    postgrest((url) => (url.pathname.endsWith('/admin_demo_summary') ? Response.json([]) : undefined));
    expect(await json(await call('GET', '/api/v1/admin/demos/summary'))).toEqual({
      pending: 0, uploaded: 0, missing: 0, expired: 0, uploaded_bytes: 0, oldest_pending_at: null, worker_online: false, worker_last_seen_at: null,
    });
  });

  it('listado: filtros a la vista y sin DEMO_BASE_URL no hay link', async () => {
    const row = { id: WID, kind: 'mix', status: 'finished', demo_status: 'uploaded', external_id: 'x', server_id: null, demo_attempts: null };
    const calls = postgrest((url) => (url.pathname.endsWith('/admin_demo_list') ? Response.json([row], { headers: { 'Content-Range': '0-0/1' } }) : undefined));
    const res = await call('GET', '/api/v1/admin/demos?status=uploaded&kind=mix&q=Dúst&sort=demo_size&order=asc&from=2026-10-01&to=2026-10-16');
    expect(res.status).toBe(200);
    expect((await json(res)).items[0]).toMatchObject({ match_id: WID, server: null, demo_url: null, demo_attempts: 0, can_retry: false });
    const q = calls.find((c) => c.url.includes('/admin_demo_list'))!.url;
    for (const part of ['demo_status=eq.uploaded', 'kind=eq.mix', 'search=ilike.%dust%', 'played_at=gte.2026-10-01', 'played_at=lte.2026-10-16', 'order=demo_size.asc.nullslast,id.asc'])
      expect(q).toContain(part);
  });

  it('alta sin fila: 500', async () => {
    postgrest((url) => (url.pathname.endsWith('/rpc/admin_create_demo_worker') ? Response.json([]) : undefined));
    expect((await call('POST', '/api/v1/admin/demo-workers', { name: 'Worker' })).status).toBe(500);
  });

  it('editar: otro error de la base pasa tal cual', async () => {
    postgrest((url) => (url.pathname.endsWith('/demo_workers') ? Response.json({ code: 'P0001', message: 'otro' }, { status: 400 }) : undefined));
    const res = await call('PATCH', `/api/v1/admin/demo-workers/${WID}`, { name: 'Nuevo' });
    expect((await json(res)).error).toMatchObject({ code: 'BUSINESS_RULE', message: 'otro' });
  });

  it('editar: si la vista no lo devuelve, valores por defecto', async () => {
    postgrest((url, m) =>
      url.pathname.endsWith('/demo_workers') && m === 'PATCH' ? Response.json([{ id: WID }]) : url.pathname.endsWith('/admin_demo_worker_list') ? Response.json([]) : undefined,
    );
    expect(await json(await call('PATCH', `/api/v1/admin/demo-workers/${WID}`, { active: true }))).toEqual({
      id: WID, name: '', active: false, online: false, last_seen_at: null, created_at: '',
    });
  });

  it('token nuevo sin confirmar: 400 sin llamar a la base', async () => {
    const calls = postgrest(() => undefined);
    expect((await call('POST', `/api/v1/admin/demo-workers/${WID}/token`, {})).status).toBe(400);
    expect(calls.some((c) => c.url.includes('/rest/v1/demo_workers') || c.url.includes('/rpc/'))).toBe(false);
  });
});
