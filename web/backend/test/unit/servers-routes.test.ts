import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { shortName } from '../../src/routes/admin-servers';
import { ServerCreate, ServerPatch } from '../../src/schemas/servers';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Admin de servidores con PostgREST simulado (sin Docker).
const USER = '77777777-7777-4777-8777-777777777777';
const SID = '11111111-1111-4111-8111-111111111111';
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
      if (new URL(raw).pathname.endsWith('/profiles')) return Response.json([{ role: 'admin' }]);
      return handler(new URL(raw), method) ?? new Response('no simulado: ' + raw, { status: 599 });
    }),
  );
  return calls;
}

const call = async (method: string, path: string, body?: unknown) =>
  makeApp().request(
    path,
    {
      method,
      headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    testEnv(),
  );

const row = { id: SID, name: 'Server', active: true, license_state: 'ok', matches: 0, created_at: '2026-10-16T00:00:00Z' };

describe('shortName', () => {
  it.each([
    ['Servidor RBK', 'servidor-rbk'],
    ['  Ñandú #1 (Argentina) ', 'nandu-1-argentina'],
    ['***', 'servidor'],
  ])('%j → %j', (name, out) => expect(shortName(name)).toBe(out));
});

describe('esquemas', () => {
  it('acepta IPv4 e IPv6 y borra con ""', () => {
    expect(ServerCreate.parse({ name: 'ab', allowed_ip: ' 10.0.0.1 ' }).allowed_ip).toBe('10.0.0.1');
    expect(ServerCreate.parse({ name: 'ab', allowed_ip: '::1' }).allowed_ip).toBe('::1');
    expect(ServerPatch.parse({ allowed_ip: '' })).toEqual({ allowed_ip: null });
    expect(ServerPatch.parse({ license_expires_at: null })).toEqual({ license_expires_at: null });
  });

  it.each([
    [{ name: 'a' }],
    [{ name: 'x'.repeat(41) }],
    [{ name: 'ab', allowed_ip: '10.0.0.0/8' }],
    [{ name: 'ab', connect_address: 'host' }],
    [{ name: 'ab', panel_server_id: 'corto' }],
    [{ name: 'ab', license_expires_at: '2026-10-16' }],
  ])('rechaza %j', (body) => expect(ServerCreate.safeParse(body).success).toBe(false));

  it('PATCH vacío no es válido', () => expect(ServerPatch.safeParse({}).success).toBe(false));
});

describe('rutas', () => {
  it('listado: filtros a la vista y orden con desempate', async () => {
    const calls = postgrest((url) => (url.pathname.endsWith('/admin_server_list') ? Response.json([row], { headers: { 'Content-Range': '0-0/1' } }) : undefined));
    const res = await call('GET', '/api/v1/admin/servers?q=Ñandú&license=expiring&online=false&has_panel=true&active=true&sort=matches&order=desc');
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ total: 1, sort: 'matches', order: 'desc', items: [{ id: SID, online: false, last_ip: null }] });
    const q = calls.find((c) => c.url.includes('/admin_server_list'))!.url;
    for (const part of ['search=ilike.%nandu%', 'license_state=eq.expiring', 'online=eq.false', 'has_panel=eq.true', 'active=eq.true', 'order=matches.desc.nullslast,id.asc'])
      expect(q).toContain(part);
  });

  it('alta: token, cfg con la URL y la key, y comando del build', async () => {
    const calls = postgrest((url) => (url.pathname.endsWith('/rpc/admin_create_server') ? Response.json([{ id: SID, token: 'csstv_abc' }]) : undefined));
    const res = await call('POST', '/api/v1/admin/servers', { name: 'Servidor RBK', allowed_ip: '' });
    expect(res.status).toBe(201);
    expect(await json(res)).toEqual({
      id: SID,
      token: 'csstv_abc',
      cfg: 'csstv_api_url "http://supabase.test/rest/v1/rpc/ingest_server_chunk"\ncsstv_api_key "anon-key-de-prueba-1234567890"\ncsstv_server_token "csstv_abc"',
      build_command: `server/build_licenciado.sh ${SID} servidor-rbk`,
    });
    expect(JSON.parse(calls.find((c) => c.url.includes('/rpc/'))!.body!)).toEqual({ p_name: 'Servidor RBK' });
  });

  it('alta sin fila: 500', async () => {
    postgrest((url) => (url.pathname.endsWith('/rpc/admin_create_server') ? Response.json([]) : undefined));
    expect((await call('POST', '/api/v1/admin/servers', { name: 'ab' })).status).toBe(500);
  });

  it('editar con nombre repetido: 409 con mensaje claro', async () => {
    postgrest((url) =>
      url.pathname.endsWith('/game_servers')
        ? Response.json({ code: '23505', message: 'duplicate key value violates unique constraint "game_servers_name_key"' }, { status: 409 })
        : undefined,
    );
    const res = await call('PATCH', `/api/v1/admin/servers/${SID}`, { name: 'Otro' });
    expect(res.status).toBe(409);
    expect((await json(res)).error.message).toBe('Ya hay un servidor con ese nombre.');
  });

  it('editar otro error de la base: pasa tal cual', async () => {
    postgrest((url) => (url.pathname.endsWith('/game_servers') ? Response.json({ code: '23514', message: 'check' }, { status: 400 }) : undefined));
    expect((await call('PATCH', `/api/v1/admin/servers/${SID}`, { name: 'Otro' })).status).toBe(400);
  });

  it('editar: manda solo los campos enviados y devuelve el servidor', async () => {
    const calls = postgrest((url) =>
      url.pathname.endsWith('/game_servers') ? Response.json([{ id: SID }]) : url.pathname.endsWith('/admin_server_list') ? Response.json([{ ...row, active: false, license_state: 'revoked' }]) : undefined,
    );
    const res = await call('PATCH', `/api/v1/admin/servers/${SID}`, { active: false, allowed_ip: '' });
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ active: false, license_state: 'revoked' });
    expect(JSON.parse(calls.find((c) => c.method === 'PATCH')!.body!)).toEqual({ active: false, allowed_ip: null });
  });

  it('valores nulos de la vista: por defecto', async () => {
    postgrest((url) => (url.pathname.endsWith('/admin_server_list') ? Response.json([{ id: SID }]) : undefined));
    expect(await json(await call('GET', `/api/v1/admin/servers/${SID}`))).toMatchObject({ name: '', active: false, license_state: 'revoked', online: false, matches: 0, created_at: '' });
  });
});
