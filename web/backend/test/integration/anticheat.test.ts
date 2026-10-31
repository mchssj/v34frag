import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Anticheat FRAG contra la Supabase local (replanteo 39).
const SECRET = `secreto-${crypto.randomUUID()}`;
const app = createApp();
const env = localEnv({ AC_API_SECRET: SECRET, CLIENT_IP_HEADER: 'x-real-ip' });
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
const steam = `7656119${seed}0001`;
const otherSteam = `7656119${seed}0002`;
const player = crypto.randomUUID();
const server = crypto.randomUUID();
const token = `ac-${seed}-${crypto.randomUUID()}`;
const IP = `10.20.${Number(seed) % 250}.1`;
let owner: { id: string; token: string };
let stranger: { id: string; token: string };
let adminToken: string;

const sha256 = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }, env);
const get = (path: string, t?: string) => app.request(path, { headers: t ? { Authorization: `Bearer ${t}` } : {} }, env);
const anon = () => createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

const enroll = async (t: string) => {
  const started = await (await post('/api/v1/anticheat/link', { device_name: 'PC de prueba', agent_version: '0.0.1' }, { 'x-real-ip': IP })).json() as { device_code: string; user_code: string };
  const ok = await post('/api/v1/me/anticheat/approve', { user_code: started.user_code }, bearer(t));
  expect(ok.status).toBe(200);
  const r = await (await post('/api/v1/anticheat/link/claim', { device_code: started.device_code })).json() as { status: string; device_id: string; access_token: string; refresh_token: string };
  expect(r.status).toBe('approved');
  return r;
};
const beat = (access: string, ip = IP) => post('/api/v1/anticheat/heartbeat', {}, { 'X-Agent-Token': access, 'x-real-ip': ip });
const bridge = async (over: Record<string, unknown> = {}) =>
  check(await anon().rpc('ac_bridge_player', { p_token: token, p_steam: steam, p_ip: IP, p_in_mix: true, ...over })).data as Record<string, unknown>;

beforeAll(async () => {
  owner = await createUser();
  stranger = await createUser();
  adminToken = (await createUser({ role: 'admin' })).token;
  const a = admin();
  check(await a.from('ac_config').update({ api_secret_hash: await sha256(SECRET), open_until: null }).eq('id', 1));
  check(await a.from('game_servers').insert({ id: server, name: `Prueba AC ${seed}`, token_hash: await sha256(token), active: true }));
  check(await a.from('players').insert({ id: player, nick: `Ac${seed}`, steam_id: steam, user_id: owner.id }));
  check(await a.from('ac_server_policy').insert({ server_id: server, protected: true, enforce_mixes: true }));
});

afterAll(async () => {
  const a = admin();
  await a.from('ac_sessions').delete().eq('server_id', server);
  await a.from('ac_devices').delete().eq('user_id', owner.id);
  await a.from('ac_server_policy').delete().eq('server_id', server);
  await a.from('players').delete().eq('id', player);
  await a.from('game_servers').delete().eq('id', server);
  await a.from('ac_config').update({ api_secret_hash: null, open_until: null }).eq('id', 1);
});

describe('vinculación del agente', () => {
  it('sin aprobar queda pendiente, y los tokens salen una sola vez', async () => {
    const s = await (await post('/api/v1/anticheat/link', { device_name: 'PC' })).json() as { device_code: string; user_code: string; verification_url: string };
    expect(s.verification_url).toContain(`/anticheat/vincular?code=${s.user_code}`);
    expect(await (await post('/api/v1/anticheat/link/claim', { device_code: s.device_code })).json()).toEqual({ status: 'pending' });
    expect((await post('/api/v1/me/anticheat/approve', { user_code: s.user_code }, bearer(owner.token))).status).toBe(200);
    const first = await (await post('/api/v1/anticheat/link/claim', { device_code: s.device_code })).json() as { status: string; access_token: string };
    expect(first.status).toBe('approved');
    expect(first.access_token).toMatch(/^fraga_/);
    expect(await (await post('/api/v1/anticheat/link/claim', { device_code: s.device_code })).json()).toEqual({ status: 'expired' });
  });

  it('sin SteamID en la ficha no se puede aprobar', async () => {
    const s = await (await post('/api/v1/anticheat/link', { device_name: 'PC' })).json() as { user_code: string };
    const r = await post('/api/v1/me/anticheat/approve', { user_code: s.user_code }, bearer(stranger.token));
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: { code: 'BUSINESS_RULE' } });
  });

  it('aprobar pide sesión', async () => {
    expect((await post('/api/v1/me/anticheat/approve', { user_code: 'AAAAAAAA' })).status).toBe(401);
  });

  it('sin el secreto de la API, la función rechaza aunque se llame directo', async () => {
    const r = await anon().rpc('ac_link_start', { p_secret: 'malo', p_device_name: 'PC', p_version: '' });
    expect(r.error?.code).toBe('42501');
    const h = await anon().rpc('ac_heartbeat', { p_secret: 'malo', p_access: 'x', p_ip: IP, p_version: '' });
    expect(h.error?.code).toBe('42501');
  });

  it('el token de renovación rota', async () => {
    const d = await enroll(owner.token);
    const r = await (await post('/api/v1/anticheat/token', { refresh_token: d.refresh_token })).json() as { access_token: string };
    expect((await beat(d.access_token)).status).toBe(401);
    expect((await beat(r.access_token)).status).toBe(200);
    expect((await post('/api/v1/anticheat/token', { refresh_token: d.refresh_token })).status).toBe(401);
  });
});

describe('Bridge y obligatoriedad', () => {
  it('jugador sin ficha: expulsado en un mix, no fuera de él', async () => {
    expect(await bridge({ p_steam: otherSteam })).toMatchObject({ linked: false, reason: 'no_profile', action: 'kick' });
    expect(await bridge({ p_steam: otherSteam, p_in_mix: false })).toMatchObject({ reason: 'no_profile', action: 'allow' });
  });

  it('token de servidor inválido: rechazado', async () => {
    const r = await anon().rpc('ac_bridge_player', { p_token: 'malo', p_steam: steam, p_ip: IP });
    expect(r.error).not.toBeNull();
  });

  it('con agente activo y misma IP: abre sesión y el agente la ve; con otra IP, expulsa y la pierde', async () => {
    const d = await enroll(owner.token);
    expect((await beat(d.access_token)).status).toBe(200);
    const ok = await bridge();
    expect(ok).toMatchObject({ linked: true, reason: 'ok', action: 'allow' });
    const h = await (await beat(d.access_token)).json() as { session: { id: string } | null };
    expect(h.session?.id).toBe(ok.session_id);
    expect((await bridge()).session_id).toBe(ok.session_id);

    expect((await beat(d.access_token, '10.99.99.99')).status).toBe(200);
    expect(await bridge()).toMatchObject({ linked: false, reason: 'ip_mismatch', action: 'kick' });
    expect(await (await beat(d.access_token)).json()).toEqual({ session: null });
  });

  it('un admin abre los mixes: nadie es expulsado; al cerrarlos, vuelve', async () => {
    expect((await post('/api/v1/admin/anticheat/open', { minutes: 30 }, bearer(owner.token))).status).toBe(403);
    expect((await post('/api/v1/admin/anticheat/open', { minutes: 30 }, bearer(adminToken))).status).toBe(200);
    expect(await bridge({ p_steam: otherSteam })).toMatchObject({ reason: 'no_profile', action: 'allow' });
    expect((await post('/api/v1/admin/anticheat/open', { minutes: 0 }, bearer(adminToken))).status).toBe(200);
    expect(await bridge({ p_steam: otherSteam })).toMatchObject({ action: 'kick' });
  });

  it('un servidor sin política no está protegido', async () => {
    const a = admin();
    const other = crypto.randomUUID();
    const t = `ac2-${seed}-${crypto.randomUUID()}`;
    check(await a.from('game_servers').insert({ id: other, name: `Sin AC ${seed}`, token_hash: await sha256(t), active: true }));
    try {
      expect(await bridge({ p_token: t })).toEqual({ protected: false, action: 'allow' });
    } finally {
      await a.from('game_servers').delete().eq('id', other);
    }
  });

  it('al desconectarse se cierra la sesión y el agente deja de recopilar', async () => {
    const d = await enroll(owner.token);
    await beat(d.access_token);
    expect(await bridge()).toMatchObject({ linked: true });
    check(await anon().rpc('ac_bridge_end', { p_token: token, p_steam: steam }));
    expect(await (await beat(d.access_token)).json()).toEqual({ session: null });
  });
});

// El ejecutable real contra la API local. Se salta si no se compiló (agent/build.bat).
const exe = fileURLToPath(new URL('../../../../agent/build/CMLeagueAC.exe', import.meta.url));
describe.skipIf(!existsSync(exe))('aplicación real', () => {
  it('vincula, abre sesión, la cierra, avisa sin conexión y desvincula', { timeout: 90_000 }, async () => {
    const envIp = localEnv({ AC_API_SECRET: SECRET });
    let server = serve({ fetch: (r) => app.fetch(r, envIp), port: 0, hostname: '127.0.0.1' });
    await new Promise((ok) => server.once('listening', ok));
    const port = (server.address() as AddressInfo).port;
    const dir = mkdtempSync(join(tmpdir(), 'cmleagueac-'));
    writeFileSync(join(dir, 'consent-1.txt'), 'version=1\n');
    const log = () => { try { return readFileSync(join(dir, 'agent.log'), 'utf8'); } catch { return ''; } };
    const until = async (re: RegExp, ms = 15_000) => {
      const end = Date.now() + ms;
      for (;;) {
        const m = re.exec(log());
        if (m) return m;
        if (Date.now() > end) throw new Error(`No apareció ${re} en el registro:\n${log()}`);
        await new Promise((ok) => setTimeout(ok, 200));
      }
    };
    const proc = spawn(exe, ['--portable', '--no-browser', '--auto-link', '--beat', '1', '--api', `http://127.0.0.1:${port}`, '--data-dir', dir]);
    try {
      const code = (await until(/código ([A-Z2-9]{8})/))[1]!;
      expect((await post('/api/v1/me/anticheat/approve', { user_code: code }, bearer(owner.token))).status).toBe(200);
      await until(/cuenta vinculada/);
      // Los tokens quedan cifrados: en disco no hay ninguno en claro.
      expect(readFileSync(join(dir, 'access.bin')).toString('latin1')).not.toContain('fraga_');
      expect(log()).not.toMatch(/fraga_|fragr_/);

      // Sin CLIENT_IP_HEADER la API ve la IP como "unknown".
      await new Promise((ok) => setTimeout(ok, 1500));
      expect(await bridge({ p_ip: 'unknown' })).toMatchObject({ linked: true, action: 'allow' });
      await until(/sesión abierta/);
      check(await anon().rpc('ac_bridge_end', { p_token: token, p_steam: steam }));
      await until(/sesión cerrada/);

      await new Promise<void>((ok) => { server.close(() => ok()); (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.(); });
      await until(/latido fallido: 0/);
      server = serve({ fetch: (r) => app.fetch(r, envIp), port, hostname: '127.0.0.1' });
      await new Promise((ok) => server.once('listening', ok));

      const before = (log().match(/latido fallido/g) ?? []).length;
      await new Promise((ok) => setTimeout(ok, 2500));
      expect((log().match(/latido fallido/g) ?? []).length).toBeLessThanOrEqual(before + 1);
    } finally {
      proc.kill();
      await new Promise<void>((ok) => { server.close(() => ok()); (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.(); });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('la ruta de desvincular revoca el token', async () => {
    const d = await enroll(owner.token);
    expect((await post('/api/v1/anticheat/unlink', {}, { 'X-Agent-Token': d.access_token })).status).toBe(204);
    expect((await beat(d.access_token)).status).toBe(401);
    expect((await post('/api/v1/anticheat/unlink', {}, { 'X-Agent-Token': d.access_token })).status).toBe(401);
  });
});

describe('permisos', () => {
  it('el público ve solo el estado', async () => {
    const r = await get(`/api/v1/players/${player}/anticheat`);
    expect(r.status).toBe(200);
    const b = await r.json() as Record<string, unknown>;
    expect(Object.keys(b).sort()).toEqual(['agent_linked', 'last_session_at', 'sessions_30d']);
    expect(b.agent_linked).toBe(true);
  });

  it('anon y terceros no leen tablas sensibles', async () => {
    const p = anon();
    for (const t of ['ac_sessions', 'ac_devices', 'ac_link_requests', 'ac_config', 'ac_admin_actions', 'ac_server_policy']) {
      expect((await p.from(t).select('*').limit(1)).error, t).not.toBeNull();
    }
    const u = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { global: { headers: bearer(stranger.token) } });
    expect((await u.from('ac_sessions').select('id').eq('server_id', server)).data).toEqual([]);
    expect((await u.from('ac_devices').select('id').eq('user_id', owner.id)).data).toEqual([]);
    expect((await u.from('ac_devices').select('access_hash').limit(1)).error).not.toBeNull();
    expect((await u.from('ac_config').select('*')).error).not.toBeNull();
  });

  it('el bucket de evidencia es privado y nadie sube', async () => {
    const a = admin();
    const b = check(await a.storage.getBucket('ac-evidence')).data as { public: boolean };
    expect(b.public).toBe(false);
    const u = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { global: { headers: bearer(owner.token) } });
    const up = await u.storage.from('ac-evidence').upload(`${seed}.jpg`, new Blob(['x'], { type: 'image/jpeg' }));
    expect(up.error).not.toBeNull();
    check(await a.storage.from('ac-evidence').upload(`${seed}.jpg`, new Blob(['x'], { type: 'image/jpeg' })));
    try {
      const signed = await u.storage.from('ac-evidence').createSignedUrl(`${seed}.jpg`, 60);
      expect(signed.error).not.toBeNull();
    } finally {
      await a.storage.from('ac-evidence').remove([`${seed}.jpg`]);
    }
  });

  it('solo un admin lista sesiones, y la lectura queda registrada', async () => {
    expect((await get('/api/v1/admin/anticheat/sessions')).status).toBe(401);
    expect((await get('/api/v1/admin/anticheat/sessions', owner.token)).status).toBe(403);
    const antes = (await admin().from('ac_admin_actions').select('id', { count: 'exact', head: true }).eq('action', 'sessions_read')).count ?? 0;
    const r = await get('/api/v1/admin/anticheat/sessions', adminToken);
    expect(r.status).toBe(200);
    const b = await r.json() as { items: { player_id: string }[] };
    expect(b.items.some((s) => s.player_id === player)).toBe(true);
    const despues = (await admin().from('ac_admin_actions').select('id', { count: 'exact', head: true }).eq('action', 'sessions_read')).count ?? 0;
    expect(despues).toBeGreaterThan(antes);
  });

  it('un tercero no desvincula un equipo ajeno; el dueño sí, y el token deja de valer', async () => {
    const d = await enroll(owner.token);
    const del = (t: string) => app.request(`/api/v1/me/anticheat/devices/${d.device_id}`, { method: 'DELETE', headers: bearer(t) }, env);
    expect((await del(stranger.token)).status).toBe(404);
    expect((await beat(d.access_token)).status).toBe(200);
    expect((await del(owner.token)).status).toBe(204);
    expect((await beat(d.access_token)).status).toBe(401);
    const list = await (await get('/api/v1/me/anticheat/devices', owner.token)).json() as { items: { id: string }[] };
    expect(list.items.map((x) => x.id)).not.toContain(d.device_id);
  });
});
