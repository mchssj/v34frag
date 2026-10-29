import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, local, localEnv } from './local';

// Relay del HUD contra la Supabase local (replanteo 36, plan docs/bitacora/2026-10-29-hud-relay-vps).
const app = createApp();
const env = localEnv({ HUD_BASE_URL: 'https://hud.test' });
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
const servers = { a: crypto.randomUUID(), b: crypto.randomUUID() };
const relayToken = `hudr_prueba_${seed}`;
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
let adminUser: { id: string; token: string };
let streamer: { id: string; token: string };
let port: number;

const call = (method: string, path: string, token: string, body?: unknown) =>
  app.request(
    path,
    {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};
// El relay entra con la clave anon y su token, como en el VPS.
const relay = (sessions: unknown[] = []) =>
  createClient(local().API_URL, local().ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    .rpc('hud_relay_config', { p_token: relayToken, p_sessions: sessions, p_seen: {} });

beforeAll(async () => {
  adminUser = await createUser({ role: 'admin' });
  streamer = await createUser({ tag: `Hud${seed}` });
  const a = admin();
  // Un puerto libre en la base local.
  const used = new Set((check(await a.from('game_servers').select('hud_port').not('hud_port', 'is', null)).data ?? []).map((r) => r.hud_port));
  port = [...Array(20).keys()].map((i) => 27500 + i).find((p) => !used.has(p))!;
  check(await a.from('game_servers').insert([
    { id: servers.a, name: `HudA${seed}`, token_hash: sha(`a${seed}`), connect_address: '10.0.0.1:27015', tv_port: 27020 },
    { id: servers.b, name: `HudB${seed}`, token_hash: sha(`b${seed}`) },
  ]));
  check(await a.from('hud_relays').insert({ name: `prueba${seed}`, token_hash: sha(relayToken) }));
});

afterAll(async () => {
  const a = admin();
  await a.from('hud_sessions').delete().eq('user_id', streamer.id);
  await a.from('hud_streamers').delete().eq('user_id', streamer.id);
  await a.from('hud_relays').delete().eq('name', `prueba${seed}`);
  await a.from('game_servers').delete().in('id', [servers.a, servers.b]);
  await a.from('notifications').delete().eq('user_id', streamer.id);
});

describe('relay del HUD', () => {
  it('el admin configura el HUD de un servidor', async () => {
    const res = await call('PUT', `/api/v1/admin/servers/${servers.a}/hud`, adminUser.token, { port, enabled: true });
    expect(res.status).toBe(200);
    const { hud } = await res.json();
    expect(hud).toMatchObject({ port, enabled: true, can_enable: true, receiving: false, streaming: [] });
    expect(hud.key).toMatch(/^[A-Za-z0-9]{24}$/);
    expect(hud.cfg).toContain(`csstv_hud_port "${port}"`);
    expect(hud.cfg).toContain('csstv_hud_host "hud.test"');

    const dup = await call('PUT', `/api/v1/admin/servers/${servers.b}/hud`, adminUser.token, { port, enabled: false });
    expect(dup.status).toBe(409);
    const noTv = await call('PUT', `/api/v1/admin/servers/${servers.b}/hud`, adminUser.token, { port: port === 27519 ? 27518 : port + 1, enabled: true });
    expect(noTv.status).toBe(400);
    expect((await call('PUT', `/api/v1/admin/servers/${servers.a}/hud`, streamer.token, { port, enabled: true })).status).toBe(403);
  });

  it('el streamer genera su link y el relay lo reconoce', async () => {
    expect((await call('POST', '/api/v1/me/hud-link', streamer.token)).status).toBe(403);
    expect((await call('POST', `/api/v1/admin/users/${streamer.id}/streamer`, adminUser.token)).status).toBe(200);
    const me = await (await call('GET', '/api/v1/me/profile', streamer.token)).json();
    expect(me.streamer).toMatchObject({ has_link: false });

    const res = await call('POST', '/api/v1/me/hud-link', streamer.token);
    expect(res.status).toBe(200);
    const link = await res.json();
    const token = /\/s\/([^/]+)\/hud$/.exec(link.hud_url)![1]!;
    expect(link.control_url).toBe(`https://hud.test/s/${token}/control`);

    const { data, error } = await relay([{ user_id: streamer.id, server_id: servers.a }]);
    expect(error).toBeNull();
    const cfg = data as { servers: { id: string; port: number; tv_address: string }[]; streamers: { user_id: string; token_hash: string }[] };
    expect(cfg.servers.find((s) => s.id === servers.a)).toMatchObject({ port, tv_address: '10.0.0.1:27020' });
    expect(cfg.streamers.find((s) => s.user_id === streamer.id)?.token_hash).toBe(sha(token));

    const server = await (await call('GET', `/api/v1/admin/servers/${servers.a}`, adminUser.token)).json();
    expect(server.hud.streaming).toEqual([{ id: streamer.id, alias: `Hud${seed}` }]);
    const users = await (await call('GET', `/api/v1/admin/users?streamer=true&q=Hud${seed}`, adminUser.token)).json();
    expect(users.items.map((u: { id: string; streamer: boolean }) => [u.id, u.streamer])).toEqual([[streamer.id, true]]);
  });

  it('quitar la marca corta el link', async () => {
    const res = await call('POST', `/api/v1/admin/users/${streamer.id}/streamer/revoke`, adminUser.token);
    expect(res.status).toBe(200);
    expect((await res.json()).active).toBe(false);
    expect((await call('POST', '/api/v1/me/hud-link', streamer.token)).status).toBe(403);
    const { data } = await relay();
    expect((data as { streamers: { user_id: string }[] }).streamers.some((s) => s.user_id === streamer.id)).toBe(false);
    const list = await (await call('GET', `/api/v1/admin/streamers?active=false&q=Hud${seed}`, adminUser.token)).json();
    expect(list.items).toHaveLength(1);
  });

  it('token del relay malo: error', async () => {
    const { error } = await createClient(local().API_URL, local().ANON_KEY, { auth: { persistSession: false } })
      .rpc('hud_relay_config', { p_token: 'hudr_otro' });
    expect(error?.code).toBe('PT401');
  });
});
