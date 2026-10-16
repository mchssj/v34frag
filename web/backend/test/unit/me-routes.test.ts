import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// /api/v1/me/* con PostgREST simulado: cubre la lógica de las rutas sin Docker (para el CI).
const USER = '44444444-4444-4444-8444-444444444444';
const PLAYER = '55555555-5555-4555-8555-555555555555';
const TEAM = '66666666-6666-4666-8666-666666666666';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null };
type Handler = (url: URL, method: string) => Response | undefined;

function postgrest(handler: Handler) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const raw = String(input instanceof Request ? input.url : input);
      const method = (input instanceof Request ? input.method : init.method) ?? 'GET';
      calls.push({ method, url: decodeURIComponent(raw), body: typeof init.body === 'string' ? init.body : null });
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      return handler(new URL(raw), method) ?? new Response('no simulado: ' + raw, { status: 599 });
    }),
  );
  return calls;
}
const rows = (data: unknown[]) => Response.json(data);
const one = (data: unknown | null) => Response.json(data === null ? [] : [data]);

// Perfil base: cuenta, detalles, jugador y equipo por membresía, 3 partidas.
function profileWorld(over: { player?: unknown | null; memberOf?: string[]; teams?: unknown[] } = {}): Handler {
  return (url, method) => {
    const p = url.pathname;
    if (p.endsWith('/profiles')) return one({ role: 'user', tag: 'Yo' });
    if (p.endsWith('/profile_details') && method === 'GET') return one({ joined_at: '2026-01-02T00:00:00Z', avatar_url: null, discord: 'd' });
    if (p.endsWith('/profile_details') && method === 'POST') return new Response(null, { status: 201 });
    if (p.endsWith('/players')) return one(over.player === undefined ? { id: PLAYER, nick: 'Jug', photo_url: null, steam_id: null } : over.player);
    if (p.endsWith('/team_members')) return Response.json((over.memberOf ?? [TEAM]).map((team_id) => ({ team_id })));
    if (p.endsWith('/teams')) return Response.json(over.teams ?? [{ id: TEAM, name: 'Equipo', tag: 'EQ', captain_id: null }]);
    if (p.endsWith('/player_matches')) return new Response(null, { status: 200, headers: { 'content-range': '*/3' } });
    if (p.endsWith('/rpc/set_my_tag')) return new Response(null, { status: 204 });
    return undefined;
  };
}

const call = async (method: string, path: string, body?: unknown) =>
  makeApp().request(
    path,
    {
      method,
      headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    },
    testEnv(),
  );

describe('GET /api/v1/me/profile', () => {
  it('arma el perfil: equipos oficiales por membresía, capitanía o dueño, y partidas jugadas', async () => {
    const calls = postgrest(profileWorld());
    const res = await call('GET', '/api/v1/me/profile');
    expect(res.status).toBe(200);
    const p = await json(res);
    expect(p).toMatchObject({
      user: { id: USER, tag: 'Yo', role: 'user', created_at: '2026-01-02T00:00:00Z' },
      player: { id: PLAYER },
      teams: [{ id: TEAM, tag: 'EQ', is_captain: false, is_member: true }],
      matches_played: 3,
    });
    expect(p.details.discord).toBe('d');
    const teams = calls.find((c) => c.url.includes('/rest/v1/teams'))!.url;
    expect(teams).toContain('kind=eq.official');
    expect(teams).toContain(`or=(captain_id.eq.${USER},owner_id.eq.${USER},id.in.(${TEAM}))`);
    const members = calls.find((c) => c.url.includes('/rest/v1/team_members'))!.url;
    expect(members).toContain(`player_id=eq.${PLAYER}`);
    expect(members).toContain('left_at=is.null');
    expect(calls.find((c) => c.url.includes('/rest/v1/player_matches'))!.url).toContain(`player_id=eq.${PLAYER}`);
  });

  it('puede estar en varios equipos; marca de cuál es capitán', async () => {
    const OTHER = '99999999-9999-4999-8999-999999999999';
    postgrest(profileWorld({
      memberOf: [TEAM, OTHER],
      teams: [{ id: OTHER, name: 'Alfa', tag: 'A', captain_id: USER }, { id: TEAM, name: 'Equipo', tag: 'EQ', captain_id: null }],
    }));
    const p = await json(await call('GET', '/api/v1/me/profile'));
    expect(p.teams).toEqual([
      { id: OTHER, name: 'Alfa', tag: 'A', is_captain: true, is_member: true },
      { id: TEAM, name: 'Equipo', tag: 'EQ', is_captain: false, is_member: true },
    ]);
  });

  it('sin jugador vinculado: solo equipos que capitanea o creó, y 0 partidas sin consultarlas', async () => {
    const calls = postgrest(profileWorld({ player: null, teams: [{ id: TEAM, name: 'Capi', tag: null, captain_id: USER }] }));
    const p = await json(await call('GET', '/api/v1/me/profile'));
    expect(p).toMatchObject({ teams: [{ id: TEAM, name: 'Capi', tag: null, is_captain: true, is_member: false }], matches_played: 0 });
    expect(calls.find((c) => c.url.includes('/rest/v1/teams'))!.url).toContain(`or=(captain_id.eq.${USER},owner_id.eq.${USER})`);
    expect(calls.some((c) => c.url.includes('/rest/v1/team_members') || c.url.includes('/rest/v1/player_matches'))).toBe(false);
  });

  it('un error de la base se traduce (42501 → 403)', async () => {
    postgrest((url) => (url.pathname.endsWith('/profiles') ? Response.json({ code: '42501', message: 'rls' }, { status: 403 }) : profileWorld()(url, 'GET')));
    const res = await call('GET', '/api/v1/me/profile');
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/v1/me/profile', () => {
  it('no llama a set_my_tag si el tag no cambió, y solo manda los campos enviados', async () => {
    const calls = postgrest(profileWorld());
    const res = await call('PATCH', '/api/v1/me/profile', { tag: 'Yo', discord: '' });
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.url.includes('/rpc/set_my_tag'))).toBe(false);
    const upsert = calls.find((c) => c.method === 'POST' && c.url.includes('/rest/v1/profile_details'))!;
    const body = JSON.parse(upsert.body!);
    expect(body).toMatchObject({ user_id: USER, discord: null });
    expect(Object.keys(body).sort()).toEqual(['discord', 'updated_at', 'user_id']);
  });

  it('cambia el tag con set_my_tag y no toca profile_details si no hay otros campos', async () => {
    const calls = postgrest(profileWorld());
    await call('PATCH', '/api/v1/me/profile', { tag: 'Otro' });
    expect(JSON.parse(calls.find((c) => c.url.includes('/rpc/set_my_tag'))!.body!)).toEqual({ p_tag: 'Otro' });
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/rest/v1/profile_details'))).toBe(false);
  });

  it('el mensaje de set_my_tag llega al usuario como BUSINESS_RULE', async () => {
    postgrest((url, m) =>
      url.pathname.endsWith('/rpc/set_my_tag')
        ? Response.json({ code: 'P0001', message: 'El nickname debe tener entre 2 y 24 caracteres' }, { status: 400 })
        : profileWorld()(url, m),
    );
    const res = await call('PATCH', '/api/v1/me/profile', { tag: 'Nuevo' });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatchObject({ code: 'BUSINESS_RULE', message: 'El nickname debe tener entre 2 y 24 caracteres' });
  });
});
