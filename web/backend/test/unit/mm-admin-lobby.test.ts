import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Salas › Ver sala (replanteo 116): solo el admin, con PostgREST simulado.
const USER = '66666666-6666-4666-8666-666666666666';
const LOBBY = '77777777-7777-4777-8777-777777777777';
const GAME = '99999999-9999-4999-8999-999999999999';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stub(role: 'admin' | 'moderator', room: unknown) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
      if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      if (url.includes('/rest/v1/profiles')) return Response.json([{ role }]);
      if (url.includes('/rpc/')) {
        calls.push(url.slice(url.indexOf('/rpc/') + 5).split('?')[0]!);
        return Response.json(room);
      }
      if (url.includes('/rest/v1/matches')) {
        calls.push('matches');
        return Response.json({ kind: 'mm', external_id: null, demo_status: 'none' });
      }
      if (url.includes('/rest/v1/match_clip_list')) {
        calls.push('match_clip_list');
        return Response.json([]);
      }
      return new Response('no simulado: ' + url, { status: 599 });
    }),
  );
  return calls;
}

const get = async () =>
  makeApp().request(`/api/v1/admin/mm/lobbies/${LOBBY}`, { headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } }, testEnv());

describe('ver una sala del matchmaking (admin)', () => {
  it('un moderador: 403 sin llegar a la base', async () => {
    const calls = stub('moderator', {});
    expect((await get()).status).toBe(403);
    expect(calls).toEqual([]);
  });

  it('el admin ve la sala tal cual la arma la base', async () => {
    const room = { id: LOBBY, status: 'live', players: [], server: { name: 'CM League #1', address: '1.2.3.4:27015', password: 'x' }, match: null };
    const calls = stub('admin', room);
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(room);
    expect(calls).toEqual(['mm_admin_lobby']);
  });

  it('una sala terminada: completa la demo y los clips', async () => {
    const calls = stub('admin', { id: LOBBY, status: 'finished', players: [], match: { game_id: GAME, demo_url: null, clips: [] } });
    const res = await get();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { match: { clips: unknown[] } }).match.clips).toEqual([]);
    expect(calls).toEqual(['mm_admin_lobby', 'matches', 'match_clip_list']);
  });

  it('si la sala no existe: 404', async () => {
    stub('admin', null);
    const res = await get();
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });
});
