import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, local, localEnv } from './local';

// Baneos contra la Supabase local (replanteo 31, plan docs/bitacora/2026-10-25-baneos-web).
const app = createApp();
const env = localEnv();
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
// SteamID 0 y 1: la ficha; 2: sin ficha, con un mix (perfil sin reclamar).
const steam = Array.from({ length: 3 }, (_, i) => `7656119${seed}${String(i).padStart(4, '0')}`);
const playerId = crypto.randomUUID();
const nick = `Ban${seed}`;
const matchId = crypto.randomUUID();
const serverId = crypto.randomUUID();
const serverToken = `token-ban-${seed}`;
let adminToken: string;
let modToken: string;
let modId: string;

const call = (method: string, path: string, body?: unknown, token?: string) =>
  app.request(
    path,
    {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
// El plugin llama con la anon key.
const plugin = () => createClient(local().API_URL, local().ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  const mod = await createUser();
  modToken = mod.token;
  modId = mod.id;
  const a = admin();
  check(await a.from('players').insert({ id: playerId, nick, steam_id: steam[0] }));
  check(await a.from('player_extra_steam_ids').insert({ steam_id: steam[1], player_id: playerId }));
  check(await a.from('matches').insert({ id: matchId, kind: 'mix', status: 'finished', map: 'de_dust2', score1: 16, score2: 10, winner_side: 1 }));
  check(await a.from('match_player_stats').insert({ match_id: matchId, steam_id: steam[2], team: 1, nick: `Suelto${seed}`, rounds: 26 }));
  check(await a.from('game_servers').insert({ id: serverId, name: `Server ${seed}`, token_hash: createHash('sha256').update(serverToken).digest('hex') }));
});

afterAll(async () => {
  const a = admin();
  await a.from('bans').update({ replaced_by: null }).in('steam_id', steam);
  await a.from('bans').delete().in('steam_id', steam);
  await a.from('match_player_stats').delete().eq('match_id', matchId);
  await a.from('matches').delete().eq('id', matchId);
  await a.from('players').delete().eq('id', playerId);
  await a.from('game_servers').delete().eq('id', serverId);
});

describe('rol de moderador', () => {
  it('el admin lo nombra y /me lo muestra', async () => {
    expect((await call('PUT', `/api/v1/admin/users/${modId}/role`, { role: 'moderator' }, adminToken)).status).toBe(204);
    expect((await (await call('GET', '/api/v1/me/profile', undefined, modToken)).json()).user.role).toBe('moderator');
  });
});

describe('baneos', () => {
  let banId: string;

  it('el moderador banea una ficha; la ficha y la lista pública lo muestran', async () => {
    const res = await call('POST', '/api/v1/admin/bans', { player_id: playerId, reason: 'Wallhack', expires_at: inDays(7) }, modToken);
    expect(res.status).toBe(201);
    const ban = await res.json();
    banId = ban.id;
    expect(ban).toMatchObject({ player: { id: playerId, alias: nick }, steam_id: steam[0], status: 'active', permanent: false, source: 'web' });

    const detail = await (await call('GET', `/api/v1/players/${playerId}`)).json();
    expect(detail.ban).toMatchObject({ id: banId, reason: 'Wallhack' });
    const pub = await (await call('GET', `/api/v1/bans?q=${nick}`)).json();
    expect(pub.items).toHaveLength(1);
    expect(pub.items[0].steam_id).toBeNull();
    // Sin sesión, el SteamID de una ficha no encuentra nada; un moderador, sí.
    expect((await (await call('GET', `/api/v1/bans?q=${steam[1]}`)).json()).total).toBe(0);
    expect((await (await call('GET', `/api/v1/bans?q=${steam[0]}`, undefined, modToken)).json()).total).toBe(1);
  });

  it('el servidor lo ve en cualquier SteamID de la ficha', async () => {
    const r = check(await plugin().rpc('csstv_ban_check', { p_token: serverToken, p_steam: steam[1] }));
    expect(r.data).toMatchObject({ ok: true, banned: true, reason: 'Wallhack' });
  });

  it('permanente: el moderador no; el admin, sí; después el moderador no lo levanta', async () => {
    expect((await call('PATCH', `/api/v1/admin/bans/${banId}`, { permanent: true }, modToken)).status).toBe(403);
    const res = await call('PATCH', `/api/v1/admin/bans/${banId}`, { permanent: true, reason: 'Wallhack (reincidente)' }, adminToken);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ permanent: true, expires_at: null, reason: 'Wallhack (reincidente)' });
    const lift = await call('POST', `/api/v1/admin/bans/${banId}/lift`, { reason: 'perdón' }, modToken);
    expect(lift.status).toBe(403);
    expect((await lift.json()).error.message).toBe('Solo un admin puede levantar un baneo permanente');
  });

  it('el admin lo levanta y la ficha queda sin baneo', async () => {
    const res = await call('POST', `/api/v1/admin/bans/${banId}/lift`, { reason: 'Apelación aceptada' }, adminToken);
    expect(res.status).toBe(200);
    expect((await res.json()).lifted).toMatchObject({ reason: 'Apelación aceptada' });
    expect((await (await call('GET', `/api/v1/players/${playerId}`)).json()).ban).toBeNull();
    const hist = await (await call('GET', `/api/v1/players/${nick}/bans`)).json();
    expect(hist.items.map((b: { status: string }) => b.status)).toEqual(['lifted']);
    expect((await call('POST', `/api/v1/admin/bans/${banId}/lift`, { reason: 'otra vez' }, adminToken)).status).toBe(400);
  });

  it('un SteamID sin ficha: el perfil sin reclamar muestra el baneo y el SteamID es público', async () => {
    const res = await call('POST', '/api/v1/admin/bans', { steam_id: steam[2], reason: 'Smurf', expires_at: inDays(1) }, modToken);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ player: null, nick: `Suelto${seed}`, steam_id: steam[2] });
    expect((await (await call('GET', `/api/v1/players/steam/${steam[2]}`)).json()).ban).toMatchObject({ reason: 'Smurf' });
    expect((await (await call('GET', `/api/v1/bans?q=${steam[2]}&status=active`)).json()).total).toBe(1);
  });

  it('!unban del juego lo levanta y queda el servidor', async () => {
    const r = check(await plugin().rpc('csstv_ban_lift', { p_token: serverToken, p_steam: steam[2], p_admin_steam: '', p_admin_name: 'Consola' }));
    expect(r.data).toEqual({ ok: true, lifted: 1 });
    const items = (await (await call('GET', `/api/v1/bans?q=${steam[2]}`)).json()).items;
    expect(items[0]).toMatchObject({ status: 'lifted', lifted: { reason: `Levantado en el servidor Server ${seed}`, by: { id: null, alias: 'Consola' } } });
  });

  it('un usuario común no banea', async () => {
    const user = await createUser();
    expect((await call('POST', '/api/v1/admin/bans', { player_id: playerId, reason: 'x', expires_at: inDays(1) }, user.token)).status).toBe(403);
  });
});
