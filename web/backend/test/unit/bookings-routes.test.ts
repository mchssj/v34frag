import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Iniciar partidas de torneo y PCW (replanteo 56), con PostgREST simulado.
const USER = '56565656-5656-4565-8565-565656565656';
const MATCH = '11111111-1111-4111-8111-111111111111';
const SERVER = '22222222-2222-4222-8222-222222222222';
const BOOKING = {
  kind: 'official', veto_done: true, can_veto: false, veto_turn_seconds: 30, maps: ['de_dust2'], my_side: 0, can_manage: true, can_start: false,
  can_ready: false, ban_until: null, booking: { id: 'b', status: 'assigned' },
};
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: Record<string, unknown> | null; auth: string | null };
type Opts = { role?: string; booking?: unknown; fail?: { fn: string; code: string; message: string; status?: number }; free?: unknown[]; bans?: unknown };

function stub(opts: Opts = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
      const method = (input instanceof Request ? input.method : init.method) ?? 'GET';
      const headers = new Headers(init.headers);
      calls.push({ method, url, body: typeof init.body === 'string' ? JSON.parse(init.body) : null, auth: headers.get('Authorization') });
      if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      if (url.includes('/rest/v1/profiles')) return Response.json([{ role: opts.role ?? 'user' }]);
      const fn = url.match(/\/rpc\/([a-z_]+)/)?.[1];
      if (fn && opts.fail?.fn === fn) return Response.json({ message: opts.fail.message, code: opts.fail.code }, { status: opts.fail.status ?? 400 });
      if (fn === 'match_booking') return Response.json(opts.booking === undefined ? BOOKING : opts.booking);
      if (fn === 'servers_free') return Response.json(opts.free ?? []);
      if (fn === 'admin_pcw_bans') return Response.json(opts.bans ?? { total: 0, items: [] });
      if (fn === 'team_pcw_ban_until') return Response.json(null);
      if (fn) return Response.json(null);
      if (url.includes('/rest/v1/events') && method === 'PATCH') return Response.json([{ id: MATCH }]);
      if (url.includes('/rest/v1/events') && method === 'GET') return Response.json({ veto_turn_seconds: 45 });
      return new Response('no simulado: ' + url, { status: 599 });
    }),
  );
  return calls;
}

const auth = async () => ({ Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json' });
const req = async (path: string, init: { method?: string; body?: unknown; anon?: boolean } = {}) =>
  makeApp().request(
    path,
    { method: init.method ?? 'GET', headers: init.anon ? {} : await auth(), body: init.body === undefined ? undefined : JSON.stringify(init.body) },
    testEnv(),
  );
const rpcs = (calls: Call[]) => calls.filter((c) => c.url.includes('/rpc/')).map((c) => ({ fn: c.url.match(/\/rpc\/([a-z_]+)/)![1], body: c.body }));

describe('GET /api/v1/matches/{id}/booking', () => {
  it('sin sesión pregunta como anónimo', async () => {
    const calls = stub();
    const res = await req(`/api/v1/matches/${MATCH}/booking`, { anon: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(BOOKING);
    expect(rpcs(calls)).toEqual([{ fn: 'match_booking', body: { p_match: MATCH } }]);
  });
  it('404 si no es una partida de torneo o PCW', async () => {
    stub({ booking: null });
    expect((await req(`/api/v1/matches/${MATCH}/booking`)).status).toBe(404);
  });
});

describe('POST /api/v1/matches/{id}/start', () => {
  it('inicia con el servidor y la espera, y devuelve la reserva', async () => {
    const calls = stub();
    const res = await req(`/api/v1/matches/${MATCH}/start`, { method: 'POST', body: { server_id: SERVER, wait_minutes: 15 } });
    expect(res.status).toBe(200);
    expect(rpcs(calls)).toEqual([
      { fn: 'match_start', body: { p_match: MATCH, p_server: SERVER, p_wait: 15 } },
      { fn: 'match_booking', body: { p_match: MATCH } },
    ]);
  });
  it('la espera por defecto es de 10 minutos y no pasa de 20', async () => {
    const calls = stub();
    await req(`/api/v1/matches/${MATCH}/start`, { method: 'POST', body: { server_id: SERVER } });
    expect(rpcs(calls)[0]!.body).toMatchObject({ p_wait: 10 });
    expect((await req(`/api/v1/matches/${MATCH}/start`, { method: 'POST', body: { server_id: SERVER, wait_minutes: 21 } })).status).toBe(400);
  });
  it('un servidor que dejó de estar libre da 409 SERVER_BUSY', async () => {
    stub({ fail: { fn: 'match_start', code: 'V5602', message: 'Ese servidor ya no está libre' } });
    const res = await req(`/api/v1/matches/${MATCH}/start`, { method: 'POST', body: { server_id: SERVER } });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'SERVER_BUSY', message: 'Ese servidor ya no está libre' } });
  });
  it('sin sesión da 401', async () => {
    stub();
    expect((await req(`/api/v1/matches/${MATCH}/start`, { method: 'POST', body: { server_id: SERVER }, anon: true })).status).toBe(401);
  });
});

describe('listos de la PCW', () => {
  it('POST marca y DELETE quita', async () => {
    const calls = stub();
    expect((await req(`/api/v1/matches/${MATCH}/ready`, { method: 'POST' })).status).toBe(200);
    expect((await req(`/api/v1/matches/${MATCH}/ready`, { method: 'DELETE' })).status).toBe(200);
    expect(rpcs(calls).filter((r) => r.fn === 'pcw_ready').map((r) => r.body)).toEqual([
      { p_match: MATCH, p_ready: true },
      { p_match: MATCH, p_ready: false },
    ]);
  });
});

describe('POST /api/v1/matches/{id}/booking/actions', () => {
  it('allow_four y extend van a match_booking_action; release a match_booking_release', async () => {
    const calls = stub();
    await req(`/api/v1/matches/${MATCH}/booking/actions`, { method: 'POST', body: { action: 'allow_four', side: 2 } });
    await req(`/api/v1/matches/${MATCH}/booking/actions`, { method: 'POST', body: { action: 'extend', minutes: 5 } });
    await req(`/api/v1/matches/${MATCH}/booking/actions`, { method: 'POST', body: { action: 'release' } });
    expect(rpcs(calls).filter((r) => r.fn !== 'match_booking')).toEqual([
      { fn: 'match_booking_action', body: { p_match: MATCH, p_action: 'allow_four', p_side: 2, p_minutes: null } },
      { fn: 'match_booking_action', body: { p_match: MATCH, p_action: 'extend', p_side: null, p_minutes: 5 } },
      { fn: 'match_booking_release', body: { p_match: MATCH } },
    ]);
  });
  it('una acción desconocida da 400', async () => {
    stub();
    expect((await req(`/api/v1/matches/${MATCH}/booking/actions`, { method: 'POST', body: { action: 'nuke' } })).status).toBe(400);
  });
});

describe('GET /api/v1/servers/free', () => {
  const free = [
    { id: 'c', name: 'CMLeague #3', region: 'Sudamerica' },
    { id: 'a', name: 'CMLeague #1', region: 'Sudamerica' },
    { id: 'b', name: 'flow', region: 'Norteamerica' },
  ];
  it('filtra, ordena y pagina', async () => {
    const calls = stub({ free });
    const res = await req('/api/v1/servers/free?kind=official&region=Sudamerica&per=1&page=2');
    expect(await res.json()).toEqual({ items: [free[0]], total: 2, page: 2, per: 1, sort: 'name', order: 'asc' });
    expect(rpcs(calls)[0]).toEqual({ fn: 'servers_free', body: { p_kind: 'official' } });
    const desc = await (await req('/api/v1/servers/free?q=cml&order=desc')).json();
    expect(desc.items.map((s: { id: string }) => s.id)).toEqual(['c', 'a']);
  });
});

describe('administración', () => {
  it('las marcas de un servidor (solo admins)', async () => {
    const calls = stub({ role: 'admin' });
    const res = await req(`/api/v1/admin/servers/${SERVER}/flags`, { method: 'PATCH', body: { official_enabled: true, pcw_enabled: false } });
    expect(res.status).toBe(204);
    expect(rpcs(calls)).toEqual([{ fn: 'server_set_flags', body: { p_server: SERVER, p_mm: null, p_official: true, p_pcw: false } }]);
    stub({ role: 'moderator' });
    expect((await req(`/api/v1/admin/servers/${SERVER}/flags`, { method: 'PATCH', body: { pcw_enabled: true } })).status).toBe(403);
  });
  it('sin marcas da 400', async () => {
    stub({ role: 'admin' });
    expect((await req(`/api/v1/admin/servers/${SERVER}/flags`, { method: 'PATCH', body: {} })).status).toBe(400);
  });
  it('sanciones de PCW: lista paginada y levantar', async () => {
    const item = {
      id: '33333333-3333-4333-8333-333333333333', team: { id: SERVER, name: 'Beta' }, player: null, until: '2026-11-05T00:00:00Z',
      reason: 'Abandonó una PCW', match_id: MATCH, created_at: '2026-11-02T00:00:00Z', lifted_at: null, active: true,
    };
    const calls = stub({ role: 'moderator', bans: { total: 1, items: [item] } });
    const res = await req('/api/v1/admin/pcw-bans?active=true&q=beta&sort=until');
    expect(await res.json()).toEqual({ items: [item], total: 1, page: 1, per: 20, sort: 'until', order: 'desc' });
    expect(rpcs(calls)[0]!.body).toEqual({ p_active: true, p_q: 'beta', p_sort: 'until', p_order: 'desc', p_page: 1, p_per: 20 });
    expect((await req(`/api/v1/admin/pcw-bans/${item.id}`, { method: 'DELETE' })).status).toBe(204);
    expect(rpcs(calls).at(-1)).toEqual({ fn: 'pcw_ban_lift', body: { p_ban: item.id } });
  });
  it('la sanción vigente impide publicar: 403 PCW_BANNED', async () => {
    stub({ fail: { fn: 'pcw_ready', code: 'V5601', message: 'Por abandonar una PCW…' } });
    const res = await req(`/api/v1/matches/${MATCH}/ready`, { method: 'POST' });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('PCW_BANNED');
  });
  it('tiempo por turno del veto de un torneo', async () => {
    const calls = stub();
    expect((await req(`/api/v1/events/${MATCH}/veto-turn`, { method: 'PUT', body: { seconds: 45 } })).status).toBe(204);
    expect(calls.find((c) => c.url.includes('/rest/v1/events'))?.body).toEqual({ veto_turn_seconds: 45 });
    expect((await req(`/api/v1/events/${MATCH}/veto-turn`, { method: 'PUT', body: { seconds: 5 } })).status).toBe(400);
    expect(await (await req(`/api/v1/events/${MATCH}/veto-turn`, { anon: true })).json()).toEqual({ seconds: 45 });
  });
  it('sanción de un equipo (pública)', async () => {
    stub();
    const res = await req(`/api/v1/teams/${SERVER}/pcw-ban`, { anon: true });
    expect(await res.json()).toEqual({ until: null });
  });
});
