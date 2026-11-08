import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Visitas a tu perfil (replanteo 86) y la página del Equipo (replanteo 87), con PostgREST simulado.
const USER = '66666666-6666-4666-8666-666666666666';
const PLAYER = '77777777-7777-4777-8777-777777777777';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const VISITS = { vip: false, total: 3, week: 1, items: null, incognito: null };
const STAFF = { admins: [{ player_id: PLAYER, nick: 'kyan', photo_url: null, level: 6 }], moderators: [], vips: [] };

function stub(errorOn?: string) {
  const calls: { fn: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : null;
      const url = decodeURIComponent(String(req ? req.url : input));
      if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      if (url.includes('/rpc/')) {
        const fn = url.slice(url.indexOf('/rpc/') + 5).split('?')[0]!;
        const raw = req ? await req.text() : init?.body;
        calls.push({ fn, body: raw ? JSON.parse(String(raw)) : null });
        if (fn === errorOn)
          return Response.json({ code: '42501', message: 'Navegar sin dejar rastro es exclusivo para VIP', details: null, hint: null }, { status: 403 });
        if (fn === 'my_profile_visits') return Response.json(VISITS);
        if (fn === 'staff_public') return Response.json(STAFF);
        if (fn === 'vip_list_me') return Response.json({ vip: true, hidden: true });
        return new Response(null, { status: 204 });
      }
      return new Response('no simulado: ' + url, { status: 599 });
    }),
  );
  return calls;
}

const auth = async () => ({ Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json' });
const call = async (method: string, path: string, body?: unknown) =>
  makeApp().request(path, { method, headers: await auth(), body: body === undefined ? undefined : JSON.stringify(body) }, testEnv());

describe('visitas a tu perfil', () => {
  it('registrar una visita: 204 y la base con el jugador', async () => {
    const calls = stub();
    expect((await call('POST', `/api/v1/players/${PLAYER}/visit`)).status).toBe(204);
    expect(calls).toEqual([{ fn: 'profile_visit', body: { p_player: PLAYER } }]);
  });

  it('sin sesión, no se registra', async () => {
    stub();
    const res = await makeApp().request(`/api/v1/players/${PLAYER}/visit`, { method: 'POST' }, testEnv());
    expect(res.status).toBe(401);
  });

  it('las mías, tal cual las da la base (sin VIP, sin quiénes)', async () => {
    stub();
    const res = await call('GET', '/api/v1/me/profile-visits');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(VISITS);
  });

  it('prender el modo oculto sin VIP: 403', async () => {
    stub('profile_incognito_set');
    expect((await call('PUT', '/api/v1/me/profile-visits/incognito', { enabled: true })).status).toBe(403);
  });
});

describe('página del Equipo', () => {
  it('el equipo y mi lugar en la lista de VIP', async () => {
    const calls = stub();
    expect(await (await call('GET', '/api/v1/staff')).json()).toEqual(STAFF);
    const res = await call('PUT', '/api/v1/me/vip-list', { hidden: true });
    expect(await res.json()).toEqual({ vip: true, hidden: true });
    expect(calls.map((c) => c.fn)).toEqual(['staff_public', 'vip_list_hidden_set', 'vip_list_me']);
  });
});
