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
import { runRetention } from '../../src/jobs/anticheat-retention';
import { admin, createUser, local, localEnv } from './local';

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
    expect(await (await beat(d.access_token)).json()).toMatchObject({ session: null });
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
    expect(await (await beat(d.access_token)).json()).toMatchObject({ session: null });
  });
});

// El ejecutable real contra la API local. Se salta si no se compiló (agent/build.bat).
const exe = fileURLToPath(new URL('../../../../agent/build/CMLeagueAC_test.exe', import.meta.url));
describe.skipIf(!existsSync(exe))('aplicación real', () => {
  it('vincula, recopila solo en la sesión, sube evidencia verificable y deja de recopilar al cerrarla', { timeout: 120_000 }, async () => {
    const envIp = localEnv({ AC_API_SECRET: SECRET, SUPABASE_SERVICE_KEY: local().SERVICE_ROLE_KEY });
    let server = serve({ fetch: (r) => app.fetch(r, envIp), port: 0, hostname: '127.0.0.1' });
    await new Promise((ok) => server.once('listening', ok));
    const port = (server.address() as AddressInfo).port;
    const dir = mkdtempSync(join(tmpdir(), 'cmleagueac-'));
    writeFileSync(join(dir, 'consent-2.txt'), 'version=2\n');
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
    const stored: string[] = [];
    const proc = spawn(exe, ['--portable', '--no-browser', '--auto-link', '--beat', '1', '--api', `http://127.0.0.1:${port}`, '--data-dir', dir,
      '--capture-title', 'CMLeague Anticheat', '--capture-no-foreground', '--capture-every', '2']);
    try {
      const code = (await until(/código ([A-Z2-9]{8})/))[1]!;
      expect((await post('/api/v1/me/anticheat/approve', { user_code: code }, bearer(owner.token))).status).toBe(200);
      await until(/cuenta vinculada/);
      // Los tokens quedan cifrados: en disco no hay ninguno en claro.
      expect(readFileSync(join(dir, 'access.bin')).toString('latin1')).not.toContain('fraga_');
      expect(log()).not.toMatch(/fraga_|fragr_/);

      // Sin CLIENT_IP_HEADER la API ve la IP como "unknown".
      await new Promise((ok) => setTimeout(ok, 1500));
      // Antes de la sesión no hay nada recopilado.
      expect(log()).not.toMatch(/inventario inicial|captura/);
      const opened = await bridge({ p_ip: 'unknown' });
      expect(opened).toMatchObject({ linked: true, action: 'allow' });
      const session = opened.session_id as string;
      await until(/sesión abierta/);
      await until(/inventario inicial: \d+ procesos/);
      await until(/procesos enviados/, 30_000);
      await until(/captura subida/, 30_000);

      // Solicitud manual: queda registrada y llega a la aplicación.
      expect((await post(`/api/v1/admin/anticheat/sessions/${session}/capture`, { reason: 'prueba' }, bearer(owner.token))).status).toBe(403);
      expect((await app.request(`/api/v1/admin/anticheat/sessions/${session}/capture`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(adminToken) }, body: JSON.stringify({ reason: 'prueba' }) }, envIp)).status).toBe(201);
      await until(/captura solicitada: tomada/);

      const readEvidence = async () => {
        const r = await app.request(`/api/v1/admin/anticheat/sessions/${session}`, { headers: bearer(adminToken) }, envIp);
        expect(r.status).toBe(200);
        return await r.json() as {
          screenshots: { sha256: string; url: string | null; kind: string; method: string; stored_at: string | null }[];
          processes: { kind: string; name: string; path: string | null }[]; requests: { status: string }[];
        };
      };
      let ev = await readEvidence();
      for (let i = 0; i < 40 && !ev.requests.some((q) => q.status === 'done'); i++) {
        await new Promise((ok) => setTimeout(ok, 500));
        ev = await readEvidence();
      }
      expect(ev.requests.map((q) => q.status)).toContain('done');
      expect(ev.screenshots.some((s) => s.kind === 'manual')).toBe(true);
      expect(ev.processes.filter((p) => p.kind === 'inventory').length).toBeGreaterThan(5);
      // Ve su propio proceso, y ninguna ruta lleva el nombre de la carpeta del usuario.
      expect(ev.processes.some((p) => /cmleagueac/i.test(p.name))).toBe(true);
      const home = process.env.USERPROFILE;
      if (home) expect(ev.processes.some((p) => p.path?.toLowerCase().startsWith(home.toLowerCase()))).toBe(false);

      // El archivo guardado es un JPEG con el hash declarado, y sin la URL firmada no se baja.
      const shot = ev.screenshots.find((s) => s.url)!;
      stored.push(...ev.screenshots.filter((s) => s.url).map((s) => s.url!.split('/ac-evidence/')[1]!.split('?')[0]!));
      const img = new Uint8Array(await (await fetch(shot.url!)).arrayBuffer());
      expect([img[0], img[1], img[2]]).toEqual([0xff, 0xd8, 0xff]);
      const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', img))].map((b) => b.toString(16).padStart(2, '0')).join('');
      expect(sha).toBe(shot.sha256);
      expect((await fetch(shot.url!.split('?')[0]!)).status).toBeGreaterThanOrEqual(400);

      // Al cerrar la sesión se deja de recopilar.
      check(await anon().rpc('ac_bridge_end', { p_token: token, p_steam: steam }));
      await until(/sesión cerrada/);
      await until(/monitoreo detenido/);
      await new Promise((ok) => setTimeout(ok, 3000));

      // Integridad: todo firmado y encadenado por la aplicación real. Una alteración después se detecta y queda registrada.
      const verify = async () => {
        const r = await app.request(`/api/v1/admin/anticheat/sessions/${session}/verify`, { method: 'POST', headers: bearer(adminToken) }, envIp);
        expect(r.status).toBe(200);
        return await r.json() as { result: string; checked: number; problems: { problem: string }[]; origin: string };
      };
      expect((await app.request(`/api/v1/admin/anticheat/sessions/${session}/verify`, { method: 'POST', headers: bearer(owner.token) }, envIp)).status).toBe(403);
      const clean = await verify();
      expect(clean.problems).toEqual([]);
      expect(clean).toMatchObject({ result: 'verified', origin: 'not_verifiable' });
      expect(clean.checked).toBeGreaterThan(1);

      const a = admin();
      const one = (await a.from('ac_process_events').select('id, name').eq('session_id', session).limit(1).single()).data!;
      check(await a.from('ac_process_events').update({ name: 'alterado.exe' }).eq('id', one.id));
      expect((await verify()).problems.map((p) => p.problem)).toContain('process_modified');
      check(await a.from('ac_process_events').update({ name: one.name }).eq('id', one.id));
      expect((await verify()).result).toBe('verified');

      const sh = (await a.from('ac_screenshots').select('storage_path').eq('session_id', session).not('stored_at', 'is', null).limit(1).single()).data!;
      const original = (await a.storage.from('ac-evidence').download(sh.storage_path as string)).data!;
      check(await a.storage.from('ac-evidence').update(sh.storage_path as string, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 9])], { type: 'image/jpeg' })));
      const tampered = await verify();
      expect(tampered.result).toBe('failed');
      expect(tampered.problems.map((p) => p.problem)).toContain('file_modified');
      check(await a.storage.from('ac-evidence').update(sh.storage_path as string, original));

      const entry = (await a.from('ac_evidence').select('id, seq').eq('session_id', session).order('seq', { ascending: false }).limit(1).single()).data!;
      const firstRow = (await a.from('ac_evidence').select('id, seq, entry').eq('session_id', session).eq('seq', 1).single()).data!;
      check(await a.from('ac_evidence').update({ entry: (firstRow.entry as string) + 'x' }).eq('id', firstRow.id));
      expect((await verify()).result).toBe('failed');
      check(await a.from('ac_evidence').update({ entry: firstRow.entry }).eq('id', firstRow.id));
      expect(entry.seq).toBeGreaterThan(0);
      const logged = await a.from('ac_integrity_logs').select('result').eq('session_id', session);
      expect((logged.data ?? []).map((l) => l.result)).toEqual(expect.arrayContaining(['verified', 'failed']));
      const after = (await admin().from('ac_screenshots').select('id', { count: 'exact', head: true }).eq('session_id', session)).count;
      await new Promise((ok) => setTimeout(ok, 5000));
      expect((await admin().from('ac_screenshots').select('id', { count: 'exact', head: true }).eq('session_id', session)).count).toBe(after);
      const all = await readEvidence();
      stored.splice(0, stored.length, ...all.screenshots.filter((s) => s.url).map((s) => s.url!.split('/ac-evidence/')[1]!.split('?')[0]!));

      await new Promise<void>((ok) => { server.close(() => ok()); (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.(); });
      await until(/latido fallido: 0/);
      server = serve({ fetch: (r) => app.fetch(r, envIp), port, hostname: '127.0.0.1' });
      await new Promise((ok) => server.once('listening', ok));

      const before = (log().match(/latido fallido/g) ?? []).length;
      await new Promise((ok) => setTimeout(ok, 2500));
      expect((log().match(/latido fallido/g) ?? []).length).toBeLessThanOrEqual(before + 1);
    } finally {
      proc.kill();
      if (stored.length) await admin().storage.from('ac-evidence').remove(stored);
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

describe('ingesta de evidencia', () => {
  const envKey = () => localEnv({ AC_API_SECRET: SECRET, SUPABASE_SERVICE_KEY: local().SERVICE_ROLE_KEY });
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const shaOf = async (b: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', b.slice().buffer))].map((x) => x.toString(16).padStart(2, '0')).join('');
  const upload = (q: Record<string, string>, body: Uint8Array, access?: string) =>
    app.request(`/api/v1/anticheat/screenshots?${new URLSearchParams(q)}`, { method: 'POST', headers: access ? { 'X-Agent-Token': access } : {}, body: body.slice().buffer }, envKey());

  it('rechaza lo que no corresponde y no duplica al reintentar', async () => {
    const d = await enroll(owner.token);
    await beat(d.access_token);
    const session = (await bridge()).session_id as string;
    const taken = new Date().toISOString();
    const base = { session_id: session, client_id: `c${seed}`, sha256: await shaOf(JPEG), width: '10', height: '10', method: 'bitblt_screen', kind: 'auto', taken_at: taken };

    expect((await upload(base, JPEG)).status).toBe(401);
    expect((await upload(base, JPEG, 'token-malo')).status).toBe(403);
    expect((await upload({ ...base, sha256: 'a'.repeat(64) }, JPEG, d.access_token)).status).toBe(400);
    expect((await upload(base, new Uint8Array([1, 2, 3, 4]), d.access_token)).status).toBe(400);
    expect((await upload({ ...base, taken_at: '2020-01-01T00:00:00Z' }, JPEG, d.access_token)).status).toBe(400);

    const first = await upload(base, JPEG, d.access_token);
    expect(first.status).toBe(201);
    const a = await first.json() as { id: string; already_stored: boolean };
    expect(a.already_stored).toBe(false);
    const again = await (await upload(base, JPEG, d.access_token)).json() as { id: string; already_stored: boolean };
    expect(again).toEqual({ id: a.id, already_stored: true });

    // Otro equipo no sube a esta sesión.
    const other = await enroll(owner.token);
    expect((await upload({ ...base, client_id: `d${seed}` }, JPEG, other.access_token)).status).toBe(400);

    // Firma: una entrada que no firmó el equipo se rechaza y queda registrada.
    const raw = crypto.getRandomValues(new Uint8Array(0));
    expect(raw.length).toBe(0);
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    const pub = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))));
    expect((await post('/api/v1/anticheat/key', { public_key: pub }, { 'X-Agent-Token': d.access_token })).status).toBe(204);
    expect((await post('/api/v1/anticheat/key', { public_key: btoa('otra-clave-distinta-del-equipo') }, { 'X-Agent-Token': d.access_token })).status).toBe(409);
    const line = `v1|${session}|1|screenshot|${base.sha256}|${'0'.repeat(64)}|${taken}`;
    const forged = btoa(String.fromCharCode(...new Uint8Array(64)));
    const signedUpload = (sig: string) => app.request(`/api/v1/anticheat/screenshots?${new URLSearchParams(base)}`, { method: 'POST', headers: { 'X-Agent-Token': d.access_token, 'X-AC-Entry': line, 'X-AC-Sig': sig }, body: JPEG.slice().buffer }, envKey());
    expect((await signedUpload(forged)).status).toBe(400);
    expect(((await admin().from('ac_integrity_logs').select('result').eq('session_id', session)).data ?? []).map((l) => l.result)).toContain('failed');
    const good = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(line)))));
    expect((await signedUpload(good)).status).toBe(201);

    const ev = { client_id: `p${seed}`, kind: 'inventory', pid: 1, name: 'a.exe', observed_at: taken };
    const send = (events: unknown[], access = d.access_token) => post('/api/v1/anticheat/processes', { session_id: session, events }, { 'X-Agent-Token': access });
    expect(await (await send([ev])).json()).toEqual({ accepted: 1, rejected: 0 });
    expect(await (await send([ev])).json()).toEqual({ accepted: 1, rejected: 0 });
    expect(await (await send([{ ...ev, client_id: `q${seed}`, observed_at: '2020-01-01T00:00:00Z' }])).json()).toEqual({ accepted: 0, rejected: 1 });
    expect(await (await send([{ ...ev, client_id: `r${seed}` }], other.access_token)).json()).toEqual({ accepted: 0, rejected: 1 });
    expect((await admin().from('ac_process_events').select('id', { count: 'exact', head: true }).eq('session_id', session).like('client_id', `%${seed}`)).count).toBe(1);

    const r = await admin().from('ac_screenshots').select('storage_path').eq('id', a.id).single();
    await admin().storage.from('ac-evidence').remove([r.data!.storage_path as string]);
    check(await anon().rpc('ac_bridge_end', { p_token: token, p_steam: steam }));
  });

  it('el jugador y el público no leen procesos ni capturas', async () => {
    for (const t of ['ac_process_events', 'ac_screenshots', 'ac_capture_requests']) {
      const u = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { global: { headers: bearer(owner.token) } });
      expect((await u.from(t).select('*').limit(1)).error, t).not.toBeNull();
      expect((await anon().from(t).select('*').limit(1)).error, t).not.toBeNull();
    }
    const id = crypto.randomUUID();
    expect((await get(`/api/v1/admin/anticheat/sessions/${id}`)).status).toBe(401);
    expect((await get(`/api/v1/admin/anticheat/sessions/${id}`, owner.token)).status).toBe(403);
    expect((await get(`/api/v1/admin/anticheat/sessions/${id}`, adminToken)).status).toBe(404);
  });
});

describe('retención', () => {
  it('borra lo vencido con sus archivos, y respeta lo abierto y lo conservado', async () => {
    const a = admin();
    const d = await enroll(owner.token);
    const device = d.device_id;
    const old = new Date(Date.now() - 31 * 864e5).toISOString();
    const mk = async (status: string, held: boolean, steamId: string) => {
      const id = crypto.randomUUID();
      check(await a.from('ac_sessions').insert({ id, device_id: device, user_id: owner.id, player_id: player, steam_id: steamId, server_id: server, status, held, started_at: old }));
      return id;
    };
    const expired = await mk('closed', false, steam);
    const kept = await mk('closed', true, steam);
    const open = await mk('open', false, otherSteam);
    const path = `${expired}/x.jpg`;
    check(await a.storage.from('ac-evidence').upload(path, new Blob(['x'], { type: 'image/jpeg' })));
    check(await a.from('ac_screenshots').insert({ session_id: expired, client_id: 'x', kind: 'auto', method: 'bitblt_screen', storage_path: path, sha256: 'a'.repeat(64), size_bytes: 1, width: 1, height: 1, taken_at: old }));

    const anonDue = await anon().rpc('ac_retention_due' as never);
    expect(anonDue.error).not.toBeNull();
    await runRetention({
      rpc: (fn, args) => a.rpc(fn, args) as never,
      removeFiles: (paths) => a.storage.from('ac-evidence').remove(paths),
    });
    const ids = ((await a.from('ac_sessions').select('id').in('id', [expired, kept, open])).data ?? []).map((r) => r.id as string);
    expect(ids).not.toContain(expired);
    expect(ids).toEqual(expect.arrayContaining([kept, open]));
    expect((await a.storage.from('ac-evidence').list(expired)).data ?? []).toEqual([]);
    await a.from('ac_sessions').delete().in('id', [kept, open]);
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
