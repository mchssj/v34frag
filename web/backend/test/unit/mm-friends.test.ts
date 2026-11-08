import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Amigos con solicitudes (replanteo 85), con PostgREST simulado.
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

function stub(error?: { code: string; message: string }) {
  const calls: { fn: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : null;
      const url = decodeURIComponent(String(req ? req.url : input));
      if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      if (url.includes('/rest/v1/profiles')) return Response.json([{ role: 'user' }]);
      if (url.includes('/rpc/')) {
        const fn = url.slice(url.indexOf('/rpc/') + 5).split('?')[0]!;
        const raw = req ? await req.text() : init?.body;
        calls.push({ fn, body: raw ? JSON.parse(String(raw)) : null });
        if (error && fn.startsWith('mm_friend')) return Response.json({ ...error, details: null, hint: null }, { status: 400 });
        if (fn === 'mm_friendship') return Response.json('received');
        return Response.json({});
      }
      return new Response('no simulado: ' + url, { status: 599 });
    }),
  );
  return calls;
}

const auth = async () => ({ Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json' });
const call = async (method: string, path: string) => makeApp().request(path, { method, headers: await auth() }, testEnv());

describe('amigos con solicitudes', () => {
  it('aceptar y rechazar llaman a mm_friend_answer con el jugador', async () => {
    const calls = stub();
    expect((await call('POST', `/api/v1/mm/friends/${PLAYER}/accept`)).status).toBe(200);
    expect((await call('POST', `/api/v1/mm/friends/${PLAYER}/reject`)).status).toBe(200);
    const answers = calls.filter((c) => c.fn === 'mm_friend_answer').map((c) => c.body);
    expect(answers).toEqual([
      { p_player: PLAYER, p_accept: true },
      { p_player: PLAYER, p_accept: false },
    ]);
  });

  it('el estado con un jugador, para el botón de su perfil', async () => {
    stub();
    const res = await call('GET', `/api/v1/mm/friends/${PLAYER}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'received' });
  });

  it('una solicitud que ya no está pendiente: 404 con el mensaje de la base', async () => {
    stub({ code: 'P0002', message: 'Esa solicitud ya no está pendiente' });
    const res = await call('POST', `/api/v1/mm/friends/${PLAYER}/accept`);
    expect(res.status).toBe(404);
    expect(JSON.stringify(await res.json())).toContain('Esa solicitud ya no está pendiente');
  });
});
