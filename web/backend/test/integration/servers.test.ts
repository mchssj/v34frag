import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Admin de servidores contra la Supabase local (con el replanteo 12 aplicado).
const app = createApp();
const env = localEnv();
const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
let adminToken: string;
const created: string[] = [];
const matchIds: string[] = [];

const call = (method: string, path: string, body?: unknown, token = adminToken) =>
  app.request(
    path,
    {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );

type Token = { id: string; token: string; cfg: string; build_command: string };
async function createServer(body: Record<string, unknown>): Promise<Token> {
  const res = await call('POST', '/api/v1/admin/servers', body);
  expect(res.status).toBe(201);
  const t = (await res.json()) as Token;
  created.push(t.id);
  return t;
}

// El plugin valida la licencia sin sesión, con la anon key.
const license = async (token: string) => {
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const r = await sb.rpc('csstv_license', { p_token: token, p_version: '2.0.0' });
  if (r.error) throw r.error;
  return r.data as { ok: boolean; reason?: string };
};

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
});

afterAll(async () => {
  const a = admin();
  if (matchIds.length) await a.from('matches').delete().in('id', matchIds);
  if (created.length) await a.from('game_servers').delete().in('id', created);
});

describe('admin de servidores', () => {
  it('un usuario común no entra', async () => {
    const u = await createUser();
    expect((await call('GET', '/api/v1/admin/servers', undefined, u.token)).status).toBe(403);
    expect((await call('POST', '/api/v1/admin/servers', { name: `No ${sfx}` }, u.token)).status).toBe(403);
  });

  it('crea un servidor, su token valida la licencia y aparece en línea', async () => {
    const t = await createServer({ name: `Señor Server ${sfx}`, connect_address: '1.2.3.4:27015', panel_server_id: 'abcd1234' });
    expect(t.token).toMatch(/^csstv_[0-9a-f]{64}$/);
    expect(t.cfg).toContain(`csstv_server_token "${t.token}"`);
    expect(t.cfg).toContain(`csstv_api_url "${env.SUPABASE_URL}/rest/v1/rpc/ingest_server_chunk"`);
    expect(t.build_command).toBe(`server/build_licenciado.sh ${t.id} senor-server-${sfx}`);

    expect(await license(t.token)).toMatchObject({ ok: true });
    const res = await call('GET', `/api/v1/admin/servers/${t.id}`);
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s).toMatchObject({
      name: `Señor Server ${sfx}`, active: true, license_state: 'ok', online: true, plugin_version: '2.0.0',
      connect_address: '1.2.3.4:27015', panel_server_id: 'abcd1234', matches: 0,
    });
    expect(s).not.toHaveProperty('token_hash');
  });

  it('rechaza nombres repetidos y formatos inválidos', async () => {
    await createServer({ name: `Repetido ${sfx}` });
    const dup = await call('POST', '/api/v1/admin/servers', { name: `  REPETIDO ${sfx} ` });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.message).toBe('Ya hay un servidor con ese nombre');

    for (const body of [
      { name: 'X' },
      { name: `IP ${sfx}`, allowed_ip: '1.2.3.0/24' },
      { name: `IP ${sfx}`, allowed_ip: '999.1.1.1' },
      { name: `Dir ${sfx}`, connect_address: '1.2.3.4' },
      { name: `Panel ${sfx}`, panel_server_id: 'a/b' },
      { name: `Vence ${sfx}`, license_expires_at: 'mañana' },
    ]) {
      const res = await call('POST', '/api/v1/admin/servers', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('edita, revoca, reactiva y regenera el token', async () => {
    const t = await createServer({ name: `Edit ${sfx}` });
    const other = await createServer({ name: `Otro ${sfx}` });

    let res = await call('PATCH', `/api/v1/admin/servers/${t.id}`, { allowed_ip: '2001:db8::1', license_expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString() });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ allowed_ip: '2001:db8::1', license_state: 'expiring' });
    // Sin IP en las cabeceras (llamada local), la IP permitida rechaza el token.
    expect(await license(t.token)).toMatchObject({ ok: false, reason: 'ip' });
    res = await call('PATCH', `/api/v1/admin/servers/${t.id}`, { allowed_ip: '', license_expires_at: null });
    expect(await res.json()).toMatchObject({ allowed_ip: null, license_expires_at: null, license_state: 'ok' });

    res = await call('PATCH', `/api/v1/admin/servers/${t.id}`, { name: `otro ${sfx}` });
    expect(res.status).toBe(409);
    expect((await res.json()).error.message).toBe('Ya hay un servidor con ese nombre.');
    expect((await call('PATCH', `/api/v1/admin/servers/${t.id}`, {})).status).toBe(400);
    expect((await call('PATCH', '/api/v1/admin/servers/00000000-0000-4000-8000-000000000000', { active: false })).status).toBe(404);

    res = await call('PATCH', `/api/v1/admin/servers/${t.id}`, { active: false });
    expect(await res.json()).toMatchObject({ active: false, license_state: 'revoked' });
    expect(await license(t.token)).toMatchObject({ ok: false, reason: 'token' });

    res = await call('POST', `/api/v1/admin/servers/${t.id}/token`);
    expect(res.status).toBe(200);
    const nuevo = (await res.json()) as Token;
    expect(nuevo.token).not.toBe(t.token);
    expect(await license(nuevo.token)).toMatchObject({ ok: true });
    expect(await license(t.token)).toMatchObject({ ok: false, reason: 'token' });
    expect((await call('GET', `/api/v1/admin/servers/${t.id}`)).status).toBe(200);
    expect(other.id).not.toBe(t.id);
    expect((await call('POST', '/api/v1/admin/servers/00000000-0000-4000-8000-000000000000/token')).status).toBe(404);
  });

  it('lista con filtros y orden', async () => {
    const vencido = await createServer({ name: `Lista${sfx} A`, license_expires_at: new Date(Date.now() - 86_400_000).toISOString() });
    await createServer({ name: `Lista${sfx} B`, panel_server_id: 'panel-0001' });

    let body = await (await call('GET', `/api/v1/admin/servers?q=lista${sfx}&sort=name&order=desc`)).json();
    expect(body).toMatchObject({ total: 2, sort: 'name', order: 'desc' });
    expect(body.items.map((s: { name: string }) => s.name)).toEqual([`Lista${sfx} B`, `Lista${sfx} A`]);

    body = await (await call('GET', `/api/v1/admin/servers?q=lista${sfx}&license=expired`)).json();
    expect(body.items.map((s: { id: string }) => s.id)).toEqual([vencido.id]);
    body = await (await call('GET', `/api/v1/admin/servers?q=lista${sfx}&has_panel=true`)).json();
    expect(body.items.map((s: { name: string }) => s.name)).toEqual([`Lista${sfx} B`]);
    body = await (await call('GET', `/api/v1/admin/servers?q=lista${sfx}&online=true`)).json();
    expect(body.total).toBe(0);
    body = await (await call('GET', `/api/v1/admin/servers?q=lista${sfx}&active=true&per=1&page=2&sort=created_at`)).json();
    expect(body).toMatchObject({ total: 2, page: 2, per: 1 });
    expect(body.items).toHaveLength(1);

    expect((await call('GET', '/api/v1/admin/servers?sort=token_hash')).status).toBe(400);

    // Un servidor vencido no sale para asignar partidas.
    const pub = await (await call('GET', `/api/v1/servers?q=lista${sfx}`)).json();
    expect(pub.items.map((s: { name: string }) => s.name)).toEqual([`Lista${sfx} B`]);
  });

  it('borra solo un servidor sin partidas', async () => {
    const libre = await createServer({ name: `Libre ${sfx}` });
    const usado = await createServer({ name: `Usado ${sfx}` });
    const m = await admin().from('matches').insert({ kind: 'mix', status: 'finished', map: 'de_dust2', played_at: new Date().toISOString(), server_id: usado.id }).select('id').single();
    if (m.error) throw m.error;
    matchIds.push(m.data.id);

    const s = await (await call('GET', `/api/v1/admin/servers/${usado.id}`)).json();
    expect(s).toMatchObject({ matches: 1 });
    expect(s.last_match_at).not.toBeNull();

    const res = await call('DELETE', `/api/v1/admin/servers/${usado.id}`);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatchObject({ code: 'BUSINESS_RULE', message: 'Este servidor tiene partidas: revocalo en vez de borrarlo' });

    expect((await call('DELETE', `/api/v1/admin/servers/${libre.id}`)).status).toBe(204);
    expect((await call('GET', `/api/v1/admin/servers/${libre.id}`)).status).toBe(404);
    expect((await call('DELETE', `/api/v1/admin/servers/${libre.id}`)).status).toBe(404);
  });
});

describe('estado de los servidores', () => {
  it('lista los activos con licencia vigente de la base, con lo que respondió cada uno', async () => {
    const { A2sError } = await import('../../src/lib/a2s');
    const name = `Estado ${Math.random().toString(36).slice(2, 8)}`;
    const id = (await admin().from('game_servers').insert({ name, token_hash: `h-${name}`, connect_address: '10.9.9.9:27062' }).select('id').single()).data!.id as string;
    const off = (await admin().from('game_servers').insert({ name: `${name} revocado`, token_hash: `h2-${name}`, connect_address: '10.9.9.8:27062', active: false }).select('id').single()).data!.id as string;
    created.push(id, off);
    const fake = Buffer.from('ffffffff49074e00646500637300435300f00005140000', 'hex');
    const app = createApp({
      udp: (host, _port, _timeoutMs, talk) =>
        talk({
          send: async () => {
            if (host === '10.9.9.9') return Uint8Array.from(fake);
            throw new A2sError('sin respuesta');
          },
        }),
    });
    const res = await app.request('/api/v1/servers/status', {}, localEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { servers: { id: string; name: string; online: boolean; players: number | null }[] };
    expect(body.servers.find((s) => s.id === id)).toMatchObject({ name, online: true, players: 5 });
    expect(body.servers.some((s) => s.name === `${name} revocado`)).toBe(false);
  });
});
