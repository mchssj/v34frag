import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Economía, tienda e inventario contra la Supabase local (replanteo 110, plan docs/bitacora/2026-11-11-tienda).
const app = createApp();
const env = localEnv();
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
const playerId = crypto.randomUUID();
const steam = `STEAM_0:1:7${seed}`;
let adminToken: string;
let user: { id: string; token: string };
const matchIds: string[] = [];

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

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  user = await createUser({ tag: `Shop${seed}` });
  const a = admin();
  check(await a.from('players').insert({ id: playerId, nick: `Shop${seed}`, user_id: user.id, steam_id: steam }));
  // Un mix ganado: partida + victoria + primera del día.
  const m = check(await a.from('matches').insert({ kind: 'mix', status: 'finished', played_at: new Date().toISOString(), winner_side: 1 } as never).select('id').single());
  const id = (m.data as unknown as { id: string }).id;
  matchIds.push(id);
  check(await a.from('match_player_stats').insert({ match_id: id, steam_id: steam, team: 1, player_id: playerId, elo_after: 1000 } as never));
});

afterAll(async () => {
  const a = admin();
  await a.from('point_ledger' as never).delete().eq('user_id' as never, user.id as never);
  await a.from('user_items' as never).delete().eq('user_id' as never, user.id as never);
  await a.from('user_cosmetics' as never).delete().eq('user_id' as never, user.id as never);
  await a.from('user_wishlist' as never).delete().eq('user_id' as never, user.id as never);
  await a.from('match_player_stats').delete().in('match_id', matchIds);
  await a.from('matches').delete().in('id', matchIds);
  await a.from('players').delete().eq('id', playerId);
});

describe('Tienda', () => {
  it('el catálogo y la economía son públicos', async () => {
    const cat = await call('GET', '/api/v1/shop/catalog');
    expect(cat.status).toBe(200);
    const c = (await cat.json()) as { items: { id: string; theme: string }[]; bundle_discount: number };
    expect(c.items.length).toBeGreaterThan(300);
    expect(c.items.find((i) => i.id === 'marco-pais-ar')?.theme).toBe('pais-ar');
    const eco = (await (await call('GET', '/api/v1/shop/economy')).json()) as { rules: { key: string; points: number }[] };
    expect(eco.rules.find((r) => r.key === 'match')?.points).toBe(10);
  });

  it('el mix ganado dio 25 puntos y la billetera pide sesión', async () => {
    expect((await call('GET', '/api/v1/me/wallet')).status).toBe(401);
    const w = (await (await call('GET', '/api/v1/me/wallet', undefined, user.token)).json()) as { points: number; matches_today: number; vip: boolean };
    expect(w).toMatchObject({ points: 25, matches_today: 1, vip: false });
    const l = (await (await call('GET', '/api/v1/me/ledger', undefined, user.token)).json()) as { items: { source: string }[] };
    expect(l.items.map((x) => x.source).sort()).toEqual(['first_of_day', 'match', 'match_win']);
  });

  it('sin saldo no compra; con el regalo del admin, sí', async () => {
    const no = await call('POST', '/api/v1/shop/buy', { item: 'marco-fuego' }, user.token);
    expect(no.status).toBe(400);
    expect(((await no.json()) as { error: { code: string } }).error.code).toBe('BUSINESS_RULE');
    expect((await call('POST', '/api/v1/admin/shop/grant', { user: user.id, currency: 'points', amount: 5000, reason: 'Prueba' }, user.token)).status).toBe(403);
    expect((await call('POST', '/api/v1/admin/shop/grant', { user: user.id, currency: 'points', amount: 5000, reason: 'Prueba' }, adminToken)).status).toBe(200);
    const ok = await call('POST', '/api/v1/shop/buy', { item: 'marco-fuego' }, user.token);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ currency: 'points', items: 1 });
    expect((await call('POST', '/api/v1/shop/buy', { item: 'marco-fuego' }, user.token)).status).toBe(409);
    expect((await call('POST', '/api/v1/shop/buy', { item: 'marco-serie-ninja' }, user.token)).status).toBe(403);
  });

  it('pack, equipar, deseos e inventario', async () => {
    const b = await call('POST', '/api/v1/shop/buy-bundle', { theme: 'pais-ar' }, user.token);
    expect(b.status).toBe(200);
    expect(((await b.json()) as { items: number }).items).toBe(4);
    const put = await call('PUT', '/api/v1/me/cosmetics', { frame: 'marco-pais-ar', stickers: ['sticker-pais-ar'] }, user.token);
    expect(put.status).toBe(200);
    expect((await call('PUT', '/api/v1/me/cosmetics', { background: 'fondo-neon' }, user.token)).status).toBe(403);
    expect(await (await call('POST', '/api/v1/me/wishlist/fondo-neon', undefined, user.token)).json()).toEqual({ on: true });
    const inv = (await (await call('GET', '/api/v1/me/inventory', undefined, user.token)).json()) as {
      items: { item_id: string; equipped: boolean }[];
      equipped: { frame: string };
      wishlist: string[];
    };
    expect(inv.items.length).toBe(5);
    expect(inv.equipped.frame).toBe('marco-pais-ar');
    expect(inv.wishlist).toEqual(['fondo-neon']);
    const pub = (await (await call('GET', `/api/v1/players/${playerId}/cosmetics`)).json()) as { frame: string; stickers: string[] };
    expect(pub).toMatchObject({ frame: 'marco-pais-ar', stickers: ['sticker-pais-ar'] });
  });

  it('admin: topes, premios y saldos', async () => {
    const e = await call('PUT', '/api/v1/admin/shop/economy', { daily_match_cap: 12, weekly_count: 6, weekly_discount: 25, bundle_discount: 20 }, adminToken);
    expect(((await e.json()) as { daily_match_cap: number }).daily_match_cap).toBe(12);
    const r = await call('PUT', '/api/v1/admin/shop/economy/rules/match', { points: 11 }, adminToken);
    expect(((await r.json()) as { rules: { key: string; points: number }[] }).rules.find((x) => x.key === 'match')?.points).toBe(11);
    await call('PUT', '/api/v1/admin/shop/economy/rules/match', { points: 10 }, adminToken);
    await call('PUT', '/api/v1/admin/shop/economy', { daily_match_cap: 10, weekly_count: 6, weekly_discount: 25, bundle_discount: 20 }, adminToken);
    expect((await call('PUT', '/api/v1/admin/shop/economy/rules/no_existe', { points: 1 }, adminToken)).status).toBe(404);
    const w = (await (await call('GET', `/api/v1/admin/shop/wallets?q=Shop${seed}`, undefined, adminToken)).json()) as {
      items: { user_id: string; items: number }[];
    };
    expect(w.items.find((x) => x.user_id === user.id)?.items).toBe(5);
    expect((await call('DELETE', `/api/v1/admin/users/${user.id}/items/marco-fuego`, { reason: 'Prueba' }, adminToken)).status).toBe(204);
  });
});
