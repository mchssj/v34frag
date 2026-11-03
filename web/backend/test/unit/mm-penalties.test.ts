import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Sanciones de la cola en Administración (replanteo 61), con PostgREST simulado.
const USER = '66666666-6666-4666-8666-666666666666';
const TARGET = '77777777-7777-4777-8777-777777777777';
const ROW = { user_id: TARGET, player_id: null, nick: 'pepe', level: 2, max_level: 4, reason: 'No aceptaste una partida', since: '2026-11-02T10:00:00Z', until: '2026-11-02T10:15:00Z' };
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null };

function stub(opts: { role?: 'admin' | 'moderator' | 'user'; liftError?: { code: string; message: string; status: number } } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
      const method = (input instanceof Request ? input.method : init.method) ?? 'GET';
      calls.push({ method, url, body: typeof init.body === 'string' ? init.body : null });
      if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      if (url.includes('/rest/v1/profiles')) return Response.json([{ role: opts.role ?? 'moderator' }]);
      if (url.includes('/rpc/mm_admin_lists')) return Response.json([ROW]);
      if (url.includes('/rpc/mm_admin_lift_penalty')) {
        const e = opts.liftError;
        return e ? Response.json({ code: e.code, message: e.message }, { status: e.status }) : new Response(null, { status: 204 });
      }
      return new Response('no simulado: ' + url, { status: 599 });
    }),
  );
  return calls;
}

const auth = async () => ({ Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json' });
const lift = async (reason: unknown, id = TARGET) =>
  makeApp().request(`/api/v1/admin/mm/penalties/${id}/lift`, { method: 'POST', headers: await auth(), body: JSON.stringify({ reason }) }, testEnv());

describe('GET /api/v1/admin/mm/penalties', () => {
  it('un moderador ve las vigentes', async () => {
    const calls = stub();
    const res = await makeApp().request('/api/v1/admin/mm/penalties', { headers: await auth() }, testEnv());
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual([ROW]);
    expect(calls.find((c) => c.url.includes('/rpc/mm_admin_lists'))!.body).toContain('"p_what":"penalties"');
  });

  it('un jugador común: 403 y no llega a la base', async () => {
    const calls = stub({ role: 'user' });
    const res = await makeApp().request('/api/v1/admin/mm/penalties', { headers: await auth() }, testEnv());
    expect(res.status).toBe(403);
    expect(calls.some((c) => c.url.includes('/rpc/'))).toBe(false);
  });

  it('sin sesión: 401', async () => {
    stub();
    expect((await makeApp().request('/api/v1/admin/mm/penalties', {}, testEnv())).status).toBe(401);
  });
});

describe('POST /api/v1/admin/mm/penalties/{id}/lift', () => {
  it('levanta con el motivo sin espacios de más', async () => {
    const calls = stub();
    const res = await lift('  Se cayó Steam  ');
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true });
    expect(JSON.parse(calls.find((c) => c.url.includes('/rpc/mm_admin_lift_penalty'))!.body!)).toEqual({ p_user: TARGET, p_reason: 'Se cayó Steam' });
  });

  it('sin motivo o con uno corto: 400 y no llega a la base', async () => {
    const calls = stub();
    expect((await lift('')).status).toBe(400);
    expect((await lift('ok')).status).toBe(400);
    expect((await lift(undefined)).status).toBe(400);
    expect(calls.some((c) => c.url.includes('/rpc/'))).toBe(false);
  });

  it('un id que no es UUID: 400', async () => {
    stub();
    expect((await lift('Se cayó Steam', 'pepe')).status).toBe(400);
  });

  it('sin sanción vigente: 404 con el mensaje de la base', async () => {
    stub({ liftError: { code: 'P0002', message: 'No tiene una sanción vigente', status: 404 } });
    const res = await lift('Se cayó Steam');
    expect(res.status).toBe(404);
    expect(JSON.stringify(await json(res))).toContain('No tiene una sanción vigente');
  });

  it('un jugador común: 403', async () => {
    stub({ role: 'user' });
    expect((await lift('Se cayó Steam')).status).toBe(403);
  });
});
