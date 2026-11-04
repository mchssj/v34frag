import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { WSContext } from 'hono/ws';
import { createMmHub } from '../../src/mm/socket';
import { makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Avisos con el dato y estado liviano (replanteo 59).
const USER = '59595959-5959-4595-8595-595959595959';
const LOBBY = '11111111-1111-4111-8111-111111111111';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function connected(hub: ReturnType<typeof createMmHub>, user: string) {
  const sent: string[] = [];
  const ws = { send: (m: string) => sent.push(m), close: () => {} } as unknown as WSContext;
  const conn = hub.open(ws)!;
  await hub.message(conn, JSON.stringify({ t: 'auth', token: user }));
  sent.length = 0;
  return sent;
}

describe('socket: dispatch', () => {
  const hub = createMmHub(async (token) => ({ id: token }));
  it('reenvía d cuando el aviso lo trae, y sigue igual sin él', async () => {
    const a = await connected(hub, 'u-a');
    const b = await connected(hub, 'u-b');
    hub.dispatch({ t: 'queue.changed', lobby: null, users: [], d: { size: 3, by_mode: { '5v5': 3 } } });
    // (mejora C) los queue.changed a todos salen agrupados, un instante después.
    await new Promise((r) => setTimeout(r, 200));
    expect(JSON.parse(a[0]!)).toEqual({ t: 'queue.changed', lobby: null, d: { size: 3, by_mode: { '5v5': 3 } } });
    expect(b).toHaveLength(1);
    hub.dispatch({ t: 'lobby.update', lobby: LOBBY, users: ['u-a'] });
    expect(JSON.parse(a[1]!)).toEqual({ t: 'lobby.update', lobby: LOBBY });
    expect(b).toHaveLength(1);
  });
});

function stub() {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
      calls.push(url);
      if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      if (url.includes('/rpc/mm_my_live')) return Response.json({ queue_size: 4, lobby: null });
      if (url.includes('/rpc/mm_my_profile')) return Response.json({ me: { nick: 'kyan' } });
      if (url.includes('/rpc/mm_lobby_match')) return Response.json({ game_id: null, stats: [] });
      return new Response('no simulado: ' + url, { status: 599 });
    }),
  );
  return calls;
}
const get = async (path: string) =>
  makeApp().request(path, { headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } }, testEnv());

describe('estado en dos partes', () => {
  it('GET /api/v1/mm/state/live: solo mm_my_live y la hora del servidor', async () => {
    const calls = stub();
    const res = await get('/api/v1/mm/state/live');
    const body = await res.json();
    expect(body).toMatchObject({ queue_size: 4, lobby: null });
    expect(typeof body.server_now).toBe('string');
    expect(calls.filter((u) => u.includes('/rpc/'))).toHaveLength(1);
  });
  it('GET /api/v1/mm/profile: mm_my_profile', async () => {
    stub();
    expect(await (await get('/api/v1/mm/profile')).json()).toMatchObject({ me: { nick: 'kyan' } });
  });
  it('GET /api/v1/mm/lobbies/{id}/match: la partida de la sala', async () => {
    const calls = stub();
    expect(await (await get(`/api/v1/mm/lobbies/${LOBBY}/match`)).json()).toEqual({ game_id: null, stats: [] });
    expect(calls.find((u) => u.includes('/rpc/mm_lobby_match'))).toBeDefined();
  });
});

describe('respuesta de las acciones (mejora B)', () => {
  function stubActions() {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
        calls.push(url);
        if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
        if (url.includes('/rpc/mm_join') || url.includes('/rpc/mm_accept') || url.includes('/rpc/mm_block')) return new Response(null, { status: 204 });
        if (url.includes('/rpc/mm_my_live')) return Response.json({ queue_size: 1, lobby: null });
        if (url.includes('/rpc/mm_my_state')) return Response.json({ queue_size: 1, lobby: null, me: { nick: 'kyan' } });
        return new Response('no simulado: ' + url, { status: 599 });
      }),
    );
    return calls;
  }
  const post = async (path: string, body?: unknown) =>
    makeApp().request(
      path,
      { method: 'POST', headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined },
      testEnv(),
    );

  it('buscar y aceptar responden con el estado liviano, sin mm_my_state', async () => {
    const calls = stubActions();
    for (const [path, body] of [['/api/v1/mm/queue', { mode: '5v5' }], ['/api/v1/mm/lobby/accept', undefined]] as const) {
      const res = await post(path, body);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ queue_size: 1, lobby: null });
    }
    const rpcs = calls.filter((u) => u.includes('/rpc/')).map((u) => u.replace(/^.*\/rpc\/([a-z_]+).*$/, '$1'));
    expect(rpcs).toEqual(['mm_join', 'mm_my_live', 'mm_accept', 'mm_my_live']);
  });

  it('una acción social sigue con el estado completo', async () => {
    const calls = stubActions();
    const res = await post('/api/v1/mm/blocks', { player_id: '22222222-2222-4222-8222-222222222222' });
    expect(res.status).toBe(200);
    expect(calls.some((u) => u.includes('/rpc/mm_my_state'))).toBe(true);
  });
});
