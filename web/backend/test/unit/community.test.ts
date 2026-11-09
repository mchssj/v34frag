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
const WALL = {
  likes: 3, dislikes: 1, my_vote: null, can_vote: true, is_owner: false, comments_open: true, can_comment: true, total: 1,
  items: [{ id: '88888888-8888-4888-8888-888888888888', body: 'buen jugador', created_at: '2026-11-09T03:00:00+00:00',
    author: { player_id: PLAYER, nick: 'kyan', photo_url: null, level: 7, verified: 'gold' }, mine: false, can_delete: false }],
};
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
        if (fn === errorOn && fn === 'profile_comment_add')
          return Response.json({ code: 'P0001', message: 'Espera unos segundos antes de comentar de nuevo', details: null, hint: null }, { status: 400 });
        if (fn === errorOn)
          return Response.json({ code: '42501', message: 'Navegar sin dejar rastro es exclusivo para VIP', details: null, hint: null }, { status: 403 });
        if (fn === 'my_profile_visits') return Response.json(VISITS);
        if (fn === 'staff_public') return Response.json(STAFF);
        if (fn === 'vip_list_me') return Response.json({ vip: true, hidden: true });
        if (fn === 'profile_wall') return Response.json(WALL);
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

describe('comentarios y votos en el perfil', () => {
  it('el muro se lee sin sesión', async () => {
    const calls = stub();
    const res = await makeApp().request(`/api/v1/players/${PLAYER}/wall`, {}, testEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(WALL);
    expect(calls).toEqual([{ fn: 'profile_wall', body: { p_player: PLAYER, p_before: null } }]);
  });

  it('votar y comentar devuelven el muro', async () => {
    const calls = stub();
    expect(await (await call('PUT', `/api/v1/players/${PLAYER}/vote`, { value: -1 })).json()).toEqual(WALL);
    expect((await call('POST', `/api/v1/players/${PLAYER}/comments`, { body: 'grande' })).status).toBe(200);
    expect(calls).toEqual([
      { fn: 'profile_vote', body: { p_player: PLAYER, p_value: -1 } },
      { fn: 'profile_wall', body: { p_player: PLAYER } },
      { fn: 'profile_comment_add', body: { p_player: PLAYER, p_body: 'grande' } },
      { fn: 'profile_wall', body: { p_player: PLAYER } },
    ]);
  });

  it('un voto que no es 1, -1 ni 0, o un comentario de más de 280: 400 sin llegar a la base', async () => {
    const calls = stub();
    expect((await call('PUT', `/api/v1/players/${PLAYER}/vote`, { value: 2 })).status).toBe(400);
    expect((await call('POST', `/api/v1/players/${PLAYER}/comments`, { body: 'x'.repeat(281) })).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('el tope de la base llega con su mensaje', async () => {
    stub('profile_comment_add');
    const res = await call('POST', `/api/v1/players/${PLAYER}/comments`, { body: 'otro' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('Espera unos segundos');
  });

  it('sin sesión no se vota ni se comenta', async () => {
    stub();
    const res = await makeApp().request(`/api/v1/players/${PLAYER}/vote`, { method: 'PUT', body: JSON.stringify({ value: 1 }) }, testEnv());
    expect(res.status).toBe(401);
  });

  it('borrar un comentario y cerrar los comentarios del perfil', async () => {
    const calls = stub();
    expect((await call('DELETE', '/api/v1/profile-comments/88888888-8888-4888-8888-888888888888')).status).toBe(204);
    expect((await call('PUT', '/api/v1/me/profile-comments', { open: false })).status).toBe(204);
    expect(calls).toEqual([
      { fn: 'profile_comment_delete', body: { p_id: '88888888-8888-4888-8888-888888888888' } },
      { fn: 'profile_comments_set', body: { p_open: false } },
    ]);
  });
});
