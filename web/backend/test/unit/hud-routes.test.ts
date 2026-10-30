import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ServerHudBody } from '../../src/schemas/hud';
import { hudCfg, hudHost, toServerHud } from '../../src/services/hud';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Relay del HUD (plan docs/bitacora/2026-10-29-hud-relay-vps) con PostgREST simulado (sin Docker). Las reglas (solo
// admins, puerto único, SourceTV para activarlo, la marca y el link) las prueba la base: pruebas/36_hud_relay.sql.
const USER = '77777777-7777-4777-8777-777777777777';
const TARGET = '88888888-8888-4888-8888-888888888888';
const SERVER = '99999999-9999-4999-8999-999999999999';
const KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null };
function postgrest(role: 'admin' | 'user', handler: (url: URL) => Response | undefined) {
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
const call = async (method: string, path: string, body?: unknown, env = testEnv({ HUD_BASE_URL: 'https://hud.cmleague.lat/' })) =>
  makeApp().request(
    path,
    {
      method,
      headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );

const server = (o: Record<string, unknown> = {}) => ({
  id: SERVER, name: 'CMLeague #1', active: true, license_state: 'ok', license_expires_at: null, allowed_ip: null, online: true,
  last_seen_at: null, last_ip: null, plugin_version: null, connect_address: '10.0.0.1:27015', panel_server_id: null, mode: 'mix',
  region: null, tv_port: 27020, matches: 0, last_match_at: null, created_at: '2026-10-01T00:00:00Z',
  hud_port: 27501, hud_enabled: true, hud_key: KEY, hud_seen_at: null, hud_streaming: [], ...o,
});
const marca = (o: Record<string, unknown> = {}) => ({
  user_id: TARGET, alias: 'Stream', granted_at: '2026-10-29T00:00:00Z', granted_by_alias: 'Admin', revoked_at: null, active: true,
  has_link: false, token_created_at: null, ...o,
});
const pgError = (code: string, message: string) => Response.json({ code, message, details: null, hint: null }, { status: 400 });
const world = (o: { server?: unknown[]; rpc?: Response; exists?: boolean; streamers?: unknown[] } = {}) => (url: URL) => {
  const p = url.pathname;
  if (p.endsWith('/admin_server_list')) return Response.json(o.server ?? [server()]);
  if (p.endsWith('/admin_user_list')) return Response.json(o.exists === false ? [] : [{ id: TARGET }]);
  if (p.endsWith('/hud_streamer_list')) return Response.json(o.streamers ?? [marca()]);
  if (p.includes('/rpc/')) return o.rpc ?? Response.json(null);
  return undefined;
};
const rpcBody = (calls: Call[], fn: string) => JSON.parse(calls.find((x) => x.url.includes(`/rpc/${fn}`))!.body!);

describe('HUD de un servidor (armado)', () => {
  it('las líneas del cfg, con el host de HUD_BASE_URL', () => {
    expect(hudHost('https://hud.cmleague.lat')).toBe('hud.cmleague.lat');
    expect(hudHost(undefined)).toBeNull();
    expect(hudCfg('hud.cmleague.lat', 27501, KEY)).toBe(
      `csstv_hud "1"\ncsstv_hud_host "hud.cmleague.lat"\ncsstv_hud_port "27501"\ncsstv_hud_key "${KEY}"`,
    );
    expect(hudCfg(null, 27501, KEY)).toContain('csstv_hud_host "COMPLETAR"');
  });

  it('recibiendo: un paquete en el último minuto; SourceTV para poder activarlo; sin puerto no hay cfg', () => {
    const now = Date.parse('2026-10-29T12:00:00Z');
    const h = toServerHud(server({ hud_seen_at: '2026-10-29T11:59:30Z', hud_streaming: [{ user_id: TARGET, alias: 'Stream' }] }), 'h', now);
    expect(h).toMatchObject({ port: 27501, enabled: true, can_enable: true, receiving: true, streaming: [{ id: TARGET, alias: 'Stream' }] });
    expect(toServerHud(server({ hud_seen_at: '2026-10-29T11:58:00Z' }), 'h', now).receiving).toBe(false);
    expect(toServerHud(server({ tv_port: null }), 'h', now).can_enable).toBe(false);
    expect(toServerHud(server({ hud_port: null, hud_key: null, hud_enabled: false }), 'h', now)).toMatchObject({ cfg: null, port: null });
  });

  it('esquema: puerto del 27500 al 27519, o null', () => {
    expect(ServerHudBody.safeParse({ port: 27501, enabled: true }).success).toBe(true);
    expect(ServerHudBody.safeParse({ port: null, enabled: false }).success).toBe(true);
    expect(ServerHudBody.safeParse({ port: 27520, enabled: true }).success).toBe(false);
    expect(ServerHudBody.safeParse({ port: 27501 }).success).toBe(false);
  });
});

describe('PUT /admin/servers/{id}/hud', () => {
  it('solo admins', async () => {
    postgrest('user', world());
    expect((await call('PUT', `/api/v1/admin/servers/${SERVER}/hud`, { port: 27501, enabled: true })).status).toBe(403);
  });

  it('llama a admin_set_server_hud y devuelve el servidor con su HUD y el cfg', async () => {
    const calls = postgrest('admin', world());
    const res = await call('PUT', `/api/v1/admin/servers/${SERVER}/hud`, { port: 27501, enabled: true });
    expect(res.status).toBe(200);
    expect(rpcBody(calls, 'admin_set_server_hud')).toEqual({ p_server: SERVER, p_port: 27501, p_enabled: true });
    const body = await json(res);
    expect(body.hud).toMatchObject({ port: 27501, enabled: true, key: KEY });
    expect(body.hud.cfg).toContain('csstv_hud_host "hud.cmleague.lat"');
  });

  it('servidor que no existe: 404, sin llamar a la base', async () => {
    const calls = postgrest('admin', world({ server: [] }));
    expect((await call('PUT', `/api/v1/admin/servers/${SERVER}/hud`, { port: 27501, enabled: true })).status).toBe(404);
    expect(calls.some((c) => c.url.includes('/rpc/'))).toBe(false);
  });

  it('puerto usado por otro (23505): 409 con el mensaje de la base; sin SourceTV (P0001): 400', async () => {
    postgrest('admin', world({ rpc: pgError('23505', 'El puerto 27501 ya lo usa el servidor RBK') }));
    const dup = await call('PUT', `/api/v1/admin/servers/${SERVER}/hud`, { port: 27501, enabled: true });
    expect(dup.status).toBe(409);
    expect((await json(dup)).error.message).toBe('El puerto 27501 ya lo usa el servidor RBK');
    postgrest('admin', world({ rpc: pgError('P0001', 'Para activar el HUD, el servidor necesita su dirección y el puerto de SourceTV') }));
    expect((await call('PUT', `/api/v1/admin/servers/${SERVER}/hud`, { port: 27501, enabled: true })).status).toBe(400);
  });

  it('clave nueva: llama a admin_regenerate_hud_key', async () => {
    const calls = postgrest('admin', world({ rpc: Response.json('b'.repeat(24)) }));
    expect((await call('POST', `/api/v1/admin/servers/${SERVER}/hud/key`)).status).toBe(200);
    expect(rpcBody(calls, 'admin_regenerate_hud_key')).toEqual({ p_server: SERVER });
  });
});

describe('streamers', () => {
  it('dar y quitar: llaman a la base y devuelven la marca', async () => {
    let calls = postgrest('admin', world());
    const res = await call('POST', `/api/v1/admin/users/${TARGET}/streamer`);
    expect(res.status).toBe(200);
    expect(rpcBody(calls, 'admin_grant_streamer')).toEqual({ p_user: TARGET });
    expect(await json(res)).toMatchObject({ user: { id: TARGET, alias: 'Stream' }, active: true, has_link: false, granted_by: 'Admin' });
    calls = postgrest('admin', world({ streamers: [marca({ active: false, revoked_at: '2026-10-29T02:00:00Z' })] }));
    const off = await call('POST', `/api/v1/admin/users/${TARGET}/streamer/revoke`);
    expect(off.status).toBe(200);
    expect(rpcBody(calls, 'admin_revoke_streamer')).toEqual({ p_user: TARGET });
    expect((await json(off)).active).toBe(false);
  });

  it('cuenta que no existe: 404', async () => {
    postgrest('admin', world({ exists: false }));
    expect((await call('POST', `/api/v1/admin/users/${TARGET}/streamer`)).status).toBe(404);
  });

  it('listado con filtro de activas', async () => {
    const calls = postgrest('admin', world());
    const res = await call('GET', '/api/v1/admin/streamers?active=true&q=str');
    expect(res.status).toBe(200);
    const url = calls.find((c) => c.url.includes('/hud_streamer_list'))!.url;
    expect(url).toContain('active=eq.true');
    expect(url).toContain('alias=ilike.%str%');
  });
});

describe('POST /me/hud-link', () => {
  it('devuelve los links con el token, una vez', async () => {
    const token = 'hud_' + 'f'.repeat(64);
    postgrest('user', world({ rpc: Response.json(token) }));
    const res = await call('POST', '/api/v1/me/hud-link');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.hud_url).toBe(`https://hud.cmleague.lat/s/${token}/hud`);
    expect(body.control_url).toBe(`https://hud.cmleague.lat/s/${token}/control`);
  });

  it('sin la marca (42501): 403; sin HUD_BASE_URL: 501', async () => {
    postgrest('user', world({ rpc: pgError('42501', 'Solo los streamers tienen link del HUD') }));
    const res = await call('POST', '/api/v1/me/hud-link');
    expect(res.status).toBe(403);
    expect((await json(res)).error.message).toBe('Solo los streamers tienen link del HUD');
    postgrest('user', world());
    expect((await call('POST', '/api/v1/me/hud-link', undefined, testEnv())).status).toBe(501);
  });
});
