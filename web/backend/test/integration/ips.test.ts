import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// IPs de los jugadores contra la Supabase local (migración 20261029180000 y replanteo 38).
const app = createApp();
const env = localEnv();
let adminToken: string;
let userToken: string;
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
const steam = [0, 1, 2].map((i) => `7656119${seed}${String(i).padStart(4, '0')}`);
const players = [0, 1].map(() => crypto.randomUUID());
const nicks = ['Alfa', 'Beta'].map((n) => `${n}Ip${seed}`);
const server = crypto.randomUUID();
const token = `ips-${seed}-${crypto.randomUUID()}`;
const ip = (n: number) => `10.${Number(seed) % 250}.${n}.1`;

const call = (path: string, t = adminToken) =>
  app.request(path, { headers: t ? { Authorization: `Bearer ${t}` } : {} }, env);
const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};
const sha256 = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  userToken = (await createUser()).token;
  const a = admin();
  check(await a.from('game_servers').insert({ id: server, name: `Prueba IPs ${seed}`, token_hash: await sha256(token), active: true }));
  // Alfa con el SteamID 0, Beta con el 1. El 2 no tiene ficha.
  check(await a.from('players').insert(players.map((id, i) => ({ id, nick: nicks[i], steam_id: steam[i] }))));
});

afterAll(async () => {
  const a = admin();
  await a.from('player_connections').delete().in('steam_id', steam);
  await a.from('player_ips').delete().in('steam_id', steam);
  await a.from('connect_attempts').delete().eq('server_id', server);
  await a.from('players').delete().in('id', players);
  await a.from('game_servers').delete().eq('id', server);
});

describe('IPs de los jugadores', () => {
  it('el plugin registra entradas e intentos con el token del servidor', async () => {
    const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const seen = [
      { steam: steam[0], ip: ip(1), nick: 'alfa' },
      { steam: steam[0], ip: ip(2), nick: 'alfa' },
      { steam: steam[1], ip: ip(1), nick: 'beta' },
      { steam: steam[2], ip: ip(1), nick: 'sinficha' },
    ];
    const { data } = check(await anon.rpc('csstv_connections', { p_token: token, p_seen: seen, p_attempts: [{ ip: ip(9), n: 40 }] }));
    expect(data).toMatchObject({ ok: true, seen: 4, attempts: 1 });
    const bad = check(await anon.rpc('csstv_connections', { p_token: 'malo', p_seen: seen }));
    expect(bad.data).toMatchObject({ ok: false });
  });

  it('nadie lee las tablas por la API pública', async () => {
    const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const r = await anon.from('player_ips').select('ip').limit(1);
    expect(r.error).not.toBeNull();
  });

  it('el admin ve las IPs de la ficha y quién más las usó', async () => {
    expect((await call(`/api/v1/admin/players/${players[0]}/ips`, userToken)).status).toBe(403);
    expect((await call(`/api/v1/admin/players/${players[0]}/ips`, '')).status).toBe(401);
    expect((await call(`/api/v1/admin/players/${crypto.randomUUID()}/ips`)).status).toBe(404);

    const res = await call(`/api/v1/admin/players/${players[0]}/ips`);
    expect(res.status).toBe(200);
    const { items } = await res.json();
    expect(items).toHaveLength(2);
    const shared = items.find((x: { ip: string }) => x.ip === ip(1));
    expect(shared).toMatchObject({ steam_id: steam[0], times: 1, last_nick: 'alfa', others: [{ id: players[1], alias: nicks[1] }], others_unlinked: 1 });
    expect(items.find((x: { ip: string }) => x.ip === ip(2))).toMatchObject({ others: [], others_unlinked: 0 });
  });
});
