import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BanCreate, BanPatch } from '../../src/schemas/bans';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Baneos (plan docs/bitacora/2026-10-25-baneos-web) con PostgREST simulado (sin Docker). Las reglas de permisos
// (permanente solo admin, moderador sin permanentes) las prueba la base: pruebas/31_baneos.sql.
const USER = '77777777-7777-4777-8777-777777777777';
const BAN = '0b0b0b0b-0000-4000-8000-000000000001';
const PLAYER = 'dddddddd-0000-4000-8000-000000000001';
const S = '76561198000000001';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null };
function postgrest(role: 'admin' | 'moderator' | 'user', handler: (url: URL) => Response | undefined) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const raw = String(input instanceof Request ? input.url : input);
      const method = (input instanceof Request ? input.method : init.method) ?? 'GET';
      calls.push({ method, url: decodeURIComponent(raw), body: typeof init.body === 'string' ? init.body : null });
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      const url = new URL(raw);
      if (url.pathname.endsWith('/profiles') && url.searchParams.get('select') === 'role') return Response.json([{ role }]);
      return handler(url) ?? new Response('no simulado: ' + raw, { status: 599 });
    }),
  );
  return calls;
}
const call = async (method: string, path: string, body?: unknown, token = true) =>
  makeApp().request(
    path,
    {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } : {}), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    testEnv(),
  );

const row = (o: Record<string, unknown> = {}) => ({
  id: BAN, player_id: PLAYER, nick: 'Ficha', steam_id: S, reason: 'Wallhack', created_at: '2026-10-26T00:00:00Z',
  expires_at: '2026-11-02T00:00:00Z', permanent: false, status: 'active', source: 'web', server_id: null, server_name: null,
  created_by: USER, created_by_alias: 'Mod', created_by_name: null, lifted_at: null, lift_reason: null, lifted_by: null,
  lifted_by_alias: null, lifted_by_name: null, replaced_by: null, ...o,
});
const banList = (rows: unknown[]) => (url: URL) => (url.pathname.endsWith('/ban_list') ? Response.json(rows) : undefined);
const rpcBody = (calls: Call[], fn: string) => JSON.parse(calls.find((x) => x.url.includes(`/rpc/${fn}`))!.body!);

describe('esquemas', () => {
  it('banear: ficha o SteamID, y vencimiento o permanente, uno de cada uno', () => {
    const until = '2026-12-01T00:00:00Z';
    expect(BanCreate.safeParse({ player_id: PLAYER, reason: 'x', expires_at: until }).success).toBe(true);
    expect(BanCreate.safeParse({ steam_id: S, reason: 'x', permanent: true }).success).toBe(true);
    expect(BanCreate.safeParse({ player_id: PLAYER, steam_id: S, reason: 'x', permanent: true }).success).toBe(false);
    expect(BanCreate.safeParse({ reason: 'x', permanent: true }).success).toBe(false);
    expect(BanCreate.safeParse({ player_id: PLAYER, reason: 'x' }).success).toBe(false);
    expect(BanCreate.safeParse({ player_id: PLAYER, reason: 'x', expires_at: until, permanent: true }).success).toBe(false);
    expect(BanCreate.safeParse({ steam_id: '123', reason: 'x', permanent: true }).success).toBe(false);
    expect(BanCreate.safeParse({ player_id: PLAYER, reason: '  ', permanent: true }).success).toBe(false);
    expect(BanCreate.safeParse({ player_id: PLAYER, reason: 'x', permanent: false }).success).toBe(false);
  });

  it('cambiar: algo que cambiar, y no vencimiento y permanente a la vez', () => {
    expect(BanPatch.safeParse({}).success).toBe(false);
    expect(BanPatch.safeParse({ reason: 'otro' }).success).toBe(true);
    expect(BanPatch.safeParse({ expires_at: '2026-12-01T00:00:00Z', permanent: true }).success).toBe(false);
  });
});

describe('lista pública', () => {
  it('sin sesión: el SteamID solo en los baneos sin ficha; busca en `search`', async () => {
    const calls = postgrest('user', banList([row(), row({ id: BAN.replace('1', '2'), player_id: null, nick: 'Suelto' })]));
    const res = await call('GET', '/api/v1/bans?q=Wall&status=active', undefined, false);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.items.map((b: { steam_id: string | null }) => b.steam_id)).toEqual([null, S]);
    expect(body.items[0]).toMatchObject({ player: { id: PLAYER, alias: 'Ficha' }, created_by: { id: USER, alias: 'Mod' }, lifted: null });
    const url = calls.find((x) => x.url.includes('/ban_list'))!.url;
    expect(url).toContain('search=ilike.%wall%');
    expect(url).toContain('status=eq.active');
  });

  it('un moderador ve todos los SteamID y busca en `search_all`', async () => {
    const calls = postgrest('moderator', banList([row()]));
    const body = await json(await call('GET', `/api/v1/bans?q=${S}`));
    expect(body.items[0].steam_id).toBe(S);
    expect(calls.find((x) => x.url.includes('/ban_list'))!.url).toContain(`search_all=ilike.%${S}%`);
  });

  it('baneo del juego levantado: el admin del juego y el motivo', async () => {
    postgrest('user', banList([row({
      source: 'server', server_id: PLAYER, server_name: 'Server', created_by: null, created_by_alias: null, created_by_name: 'AdminJuego',
      status: 'lifted', lifted_at: '2026-10-27T00:00:00Z', lift_reason: 'Apelación', lifted_by_name: 'Otro',
    })]));
    const body = await json(await call('GET', '/api/v1/bans', undefined, false));
    expect(body.items[0]).toMatchObject({
      server: { id: PLAYER, name: 'Server' }, created_by: { id: null, alias: 'AdminJuego' },
      lifted: { at: '2026-10-27T00:00:00Z', reason: 'Apelación', by: { id: null, alias: 'Otro' }, replaced_by: null },
    });
  });
});

describe('admin', () => {
  it('un usuario común no banea', async () => {
    const calls = postgrest('user', () => undefined);
    const res = await call('POST', '/api/v1/admin/bans', { player_id: PLAYER, reason: 'x', expires_at: '2026-12-01T00:00:00Z' });
    expect(res.status).toBe(403);
    expect(calls.some((x) => x.url.includes('/rpc/'))).toBe(false);
  });

  it('banear: los que no se usan van en null y devuelve el baneo', async () => {
    const calls = postgrest('moderator', (url) =>
      url.pathname.endsWith('/rpc/ban_create') ? Response.json(BAN) : banList([row()])(url),
    );
    const res = await call('POST', '/api/v1/admin/bans', { steam_id: S, reason: ' Smurf ', expires_at: '2026-12-01T00:00:00Z' });
    expect(res.status).toBe(201);
    expect(rpcBody(calls, 'ban_create')).toEqual({ p_player: null, p_steam: S, p_reason: 'Smurf', p_expires: '2026-12-01T00:00:00Z' });
    expect((await json(res)).steam_id).toBe(S);
  });

  it('permanente: p_expires en null', async () => {
    const calls = postgrest('admin', (url) => (url.pathname.endsWith('/rpc/ban_create') ? Response.json(BAN) : banList([row()])(url)));
    await call('POST', '/api/v1/admin/bans', { player_id: PLAYER, reason: 'x', permanent: true });
    expect(rpcBody(calls, 'ban_create')).toMatchObject({ p_player: PLAYER, p_steam: null, p_expires: null });
  });

  it('la regla de la base llega como 403 con su mensaje', async () => {
    postgrest('moderator', (url) =>
      url.pathname.endsWith('/rpc/ban_create')
        ? Response.json({ code: '42501', message: 'Solo un admin puede banear de forma permanente' }, { status: 403 })
        : undefined,
    );
    const res = await call('POST', '/api/v1/admin/bans', { player_id: PLAYER, reason: 'x', permanent: true });
    expect(res.status).toBe(403);
    expect((await json(res)).error.message).toBe('Solo un admin puede banear de forma permanente');
  });

  it('cambiar o levantar uno que no existe: 404 sin llamar a la función', async () => {
    const calls = postgrest('moderator', banList([]));
    expect((await call('PATCH', `/api/v1/admin/bans/${BAN}`, { reason: 'otro' })).status).toBe(404);
    expect((await call('POST', `/api/v1/admin/bans/${BAN}/lift`, { reason: 'perdón' })).status).toBe(404);
    expect(calls.some((x) => x.url.includes('/rpc/'))).toBe(false);
  });

  it('cambiar y levantar', async () => {
    const calls = postgrest('admin', (url) => (url.pathname.includes('/rpc/') ? new Response(null, { status: 204 }) : banList([row()])(url)));
    expect((await call('PATCH', `/api/v1/admin/bans/${BAN}`, { permanent: true })).status).toBe(200);
    expect(rpcBody(calls, 'ban_update')).toEqual({ p_id: BAN, p_reason: null, p_expires: null, p_permanent: true });
    expect((await call('POST', `/api/v1/admin/bans/${BAN}/lift`, { reason: 'Apelación' })).status).toBe(200);
    expect(rpcBody(calls, 'ban_lift')).toEqual({ p_id: BAN, p_reason: 'Apelación' });
  });
});
