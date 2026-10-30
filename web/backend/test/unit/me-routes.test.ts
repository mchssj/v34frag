import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

const DEFAULTS = { team: true, tournament: true, pcw: true, elo: true, season: true, account: true, news: false, admin: true };

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
function profileWorld(over: { player?: unknown | null; memberOf?: string[]; teams?: unknown[]; prefs?: unknown; vip?: unknown[]; streamer?: unknown[] } = {}): Handler {
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
    if (p.endsWith('/user_preferences')) return one(over.prefs === undefined ? null : { preferences: over.prefs });
    if (p.endsWith('/rpc/set_my_preferences')) return Response.json({});
    if (p.endsWith('/vip_status')) return rows(over.vip ?? []);
    if (p.endsWith('/hud_streamer_list')) return rows(over.streamer ?? []);
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

  it('vip: null si nunca fue VIP; el estado de vip_status de la cuenta', async () => {
    postgrest(profileWorld());
    expect((await json(await call('GET', '/api/v1/me/profile'))).vip).toBeNull();
    const calls = postgrest(profileWorld({
      vip: [{ user_id: USER, alias: 'Yo', player_id: PLAYER, photo_url: null, status: 'active', active: true, lifetime: false,
              until: '2026-12-01T00:00:00Z', since: '2026-10-01T00:00:00Z', last_change: '2026-10-01T00:00:00Z' }],
    }));
    expect((await json(await call('GET', '/api/v1/me/profile'))).vip).toEqual({
      active: true, lifetime: false, until: '2026-12-01T00:00:00Z', since: '2026-10-01T00:00:00Z',
    });
    expect(calls.find((c) => c.url.includes('/rest/v1/vip_status'))!.url).toContain(`user_id=in.(${USER})`);
  });

  it('streamer: null sin la marca o si se la quitaron; con la marca, desde cuándo y si tiene link', async () => {
    postgrest(profileWorld());
    expect((await json(await call('GET', '/api/v1/me/profile'))).streamer).toBeNull();
    const marca = { user_id: USER, alias: 'Yo', granted_at: '2026-10-29T00:00:00Z', granted_by_alias: 'Admin', revoked_at: null,
                    active: true, has_link: true, token_created_at: '2026-10-29T01:00:00Z' };
    postgrest(profileWorld({ streamer: [{ ...marca, active: false, revoked_at: '2026-10-29T02:00:00Z' }] }));
    expect((await json(await call('GET', '/api/v1/me/profile'))).streamer).toBeNull();
    const calls = postgrest(profileWorld({ streamer: [marca] }));
    expect((await json(await call('GET', '/api/v1/me/profile'))).streamer).toEqual({
      since: '2026-10-29T00:00:00Z', has_link: true, link_created_at: '2026-10-29T01:00:00Z',
    });
    expect(calls.find((c) => c.url.includes('/rest/v1/hud_streamer_list'))!.url).toContain(`user_id=in.(${USER})`);
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

  it('preferencias: null sin fila; el valor guardado; un valor desconocido se ignora', async () => {
    postgrest(profileWorld());
    expect((await json(await call('GET', '/api/v1/me/profile'))).preferences).toEqual({ theme_fx: null, notifications: DEFAULTS });
    postgrest(profileWorld({ prefs: { theme_fx: 'silent', otra: 1 } }));
    expect((await json(await call('GET', '/api/v1/me/profile'))).preferences).toEqual({ theme_fx: 'silent', notifications: DEFAULTS });
    postgrest(profileWorld({ prefs: { theme_fx: 'fuerte' } }));
    expect((await json(await call('GET', '/api/v1/me/profile'))).preferences).toEqual({ theme_fx: null, notifications: DEFAULTS });
  });

  it('notificaciones: el mapa completo, con lo guardado encima de los valores por defecto (news apagada)', async () => {
    postgrest(profileWorld({ prefs: { notifications: { pcw: false, news: true, otra: true, team: 'no' } } }));
    expect((await json(await call('GET', '/api/v1/me/profile'))).preferences.notifications).toEqual({ ...DEFAULTS, pcw: false, news: true });
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

  it('preferencias: llama a set_my_preferences con lo enviado y no toca profile_details', async () => {
    const calls = postgrest(profileWorld());
    expect((await call('PATCH', '/api/v1/me/profile', { preferences: { theme_fx: 'off' } })).status).toBe(200);
    expect(JSON.parse(calls.find((c) => c.url.includes('/rpc/set_my_preferences'))!.body!)).toEqual({ p_changes: { theme_fx: 'off' } });
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/rest/v1/profile_details'))).toBe(false);
    await call('PATCH', '/api/v1/me/profile', { preferences: { theme_fx: null } });
    expect(JSON.parse(calls.filter((c) => c.url.includes('/rpc/set_my_preferences')).at(-1)!.body!)).toEqual({ p_changes: { theme_fx: null } });
  });

  it('notificaciones: une las categorías enviadas con las guardadas', async () => {
    const calls = postgrest(profileWorld({ prefs: { theme_fx: 'off', notifications: { pcw: false } } }));
    expect((await call('PATCH', '/api/v1/me/profile', { preferences: { notifications: { news: true } } })).status).toBe(200);
    expect(JSON.parse(calls.find((c) => c.url.includes('/rpc/set_my_preferences'))!.body!)).toEqual({
      p_changes: { notifications: { pcw: false, news: true } },
    });
  });

  it('notificaciones: 400 con una categoría que no existe o un valor que no es booleano', async () => {
    const calls = postgrest(profileWorld());
    for (const notifications of [{ chat: true }, { pcw: 'no' }]) {
      expect((await call('PATCH', '/api/v1/me/profile', { preferences: { notifications } })).status).toBe(400);
    }
    expect(calls.some((c) => c.url.includes('/rpc/set_my_preferences'))).toBe(false);
  });

  it('preferencias: 400 VALIDATION_ERROR con otro valor o una clave desconocida', async () => {
    const calls = postgrest(profileWorld());
    for (const preferences of [{ theme_fx: 'fuerte' }, { theme_fx: true }, { otra: 1 }, 'full']) {
      const res = await call('PATCH', '/api/v1/me/profile', { preferences });
      expect(res.status).toBe(400);
      expect((await json(res)).error.code).toBe('VALIDATION_ERROR');
    }
    expect(calls.some((c) => c.url.includes('/rpc/set_my_preferences'))).toBe(false);
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
