import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Códigos canjeables contra la Supabase local con el replanteo 126 (bitácora docs/bitacora/2026-11-16-codigos-canjeables).
// El tope por IP es de 10 canjes por minuto por app: el bloque de fallos usa otra app.
const env = localEnv();
const steam = () => '7656119' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');

type Res = { status: number; body: any; headers: Headers };
const client = (app = createApp()) =>
  async function req(method: string, path: string, opts: { token?: string; body?: unknown } = {}): Promise<Res> {
    const headers: Record<string, string> = {};
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await app.request(path, { method, headers, ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}) }, env);
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
  };
const req = client();
const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};

let adminUser: { id: string; token: string };
let player: { id: string; token: string };
let other: { id: string; token: string };
let noPlayer: { id: string; token: string };
const fichas = [crypto.randomUUID(), crypto.randomUUID()];
let item = '';
const codeIds: string[] = [];

const create = async (body: Record<string, unknown>) => {
  const r = await req('POST', '/api/v1/admin/codes', { token: adminUser.token, body: { label: 'Prueba integración', ...body } });
  expect(r.status).toBe(201);
  for (const c of r.body.codes) codeIds.push(c.id);
  return r.body.codes[0].code as string;
};

beforeAll(async () => {
  adminUser = await createUser({ role: 'admin' });
  player = await createUser();
  other = await createUser();
  noPlayer = await createUser();
  const db = admin();
  check(await db.from('players').insert([
    { id: fichas[0], nick: `cod${fichas[0]!.slice(0, 6)}`, steam_id: steam(), user_id: player.id },
    { id: fichas[1], nick: `cod${fichas[1]!.slice(0, 6)}`, steam_id: steam(), user_id: other.id },
  ]));
  const i = check(await db.from('shop_items').select('id').eq('kind', 'frame').eq('vip_only', false).eq('vip_reward', false).eq('active', true).limit(1).single());
  item = (i.data as { id: string }).id;
});

afterAll(async () => {
  const db = admin();
  const users = [player.id, other.id, noPlayer.id];
  await db.from('point_grants').delete().in('user_id', users);
  await db.from('code_redemptions' as never).delete().in('user_id', users);
  await db.from('redeem_attempts' as never).delete().in('user_id', users);
  await db.from('redeem_codes' as never).delete().in('id', codeIds);
  await db.from('user_items').delete().in('user_id', users);
  await db.from('vip_memberships').delete().in('user_id', users);
  await db.from('notifications').delete().in('user_id', users);
  await db.from('players').delete().in('id', fichas);
});

describe('códigos canjeables', () => {
  it('el admin crea un código de puntos; el jugador lo canjea y sale en su historial', async () => {
    const code = await create({ reward: 'points', amount: 700 });
    expect(code).toMatch(/^CML-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    const r = await req('POST', '/api/v1/me/redeem', { token: player.token, body: { code: code.toLowerCase().replaceAll('-', ' ') } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ reward: 'points', amount: 700, label: 'Prueba integración' });
    const pts = await req('GET', '/api/v1/me/points', { token: player.token });
    expect(pts.body.points.granted).toBe(700);
    const h = await req('GET', '/api/v1/me/points/history', { token: player.token });
    expect(h.body.items.find((x: { kind: string }) => x.kind === 'code')).toMatchObject({ amount: 700, label: 'Código: Prueba integración' });
    const again = await req('POST', '/api/v1/me/redeem', { token: player.token, body: { code } });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('CODE_ALREADY_REDEEMED');
    expect((await req('POST', '/api/v1/me/redeem', { token: other.token, body: { code } })).body.error.code).toBe('CODE_USED_UP');
  });

  it('un artículo por 7 días: en el catálogo y en el inventario con su vencimiento', async () => {
    const r = await req('POST', '/api/v1/me/redeem', { token: player.token, body: { code: await create({ reward: 'item', item, days: 7 }) } });
    expect(r.status).toBe(200);
    expect(r.body.item.id).toBe(item);
    const until = Date.parse(r.body.until);
    expect(until).toBeGreaterThan(Date.now() + 6.9 * 86_400_000);
    const cat = await req('GET', `/api/v1/shop/items?owned=true&per=400`, { token: player.token });
    const mine = cat.body.items.find((x: { id: string }) => x.id === item);
    expect(mine).toMatchObject({ owned: true, usable: true });
    expect(Date.parse(mine.expires_at)).toBe(until);
    const inv = await req('GET', `/api/v1/admin/users/${player.id}/items`, { token: adminUser.token });
    expect(inv.body.items.find((x: { item: { id: string } }) => x.item.id === item)).toMatchObject({ source: 'code', currency: null });
    // vencido: deja de ser suyo y se puede comprar
    check(await admin().from('user_items').update({ expires_at: new Date(Date.now() - 60_000).toISOString() } as never).eq('user_id', player.id).eq('item_id', item));
    const cat2 = await req('GET', `/api/v1/shop/items?owned=false&per=400`, { token: player.token });
    expect(cat2.body.items.find((x: { id: string }) => x.id === item)).toMatchObject({ owned: false, usable: false });
  });

  it('lo VIP de un código se usa sin ser VIP mientras code_vip_free esté encendido', async () => {
    const v = check(
      await admin().from('shop_items').select('id').eq('vip_only', true).eq('vip_reward', false).eq('kind', 'sticker').limit(1).single(),
    );
    const vipItem = (v.data as { id: string }).id;
    expect((await req('POST', '/api/v1/me/redeem', { token: player.token, body: { code: await create({ reward: 'item', item: vipItem }) } })).status).toBe(200);
    const usable = async () =>
      (await req('GET', '/api/v1/shop/items?owned=true&per=400', { token: player.token })).body.items.find((x: { id: string }) => x.id === vipItem)
        ?.usable;
    expect(await usable()).toBe(true);
    const off = await req('PUT', '/api/v1/admin/points/config', { token: adminUser.token, body: { code_vip_free: false } });
    expect(off.status).toBe(200);
    expect(off.body.code_vip_free).toBe(false);
    try {
      expect(await usable()).toBe(false);
    } finally {
      await req('PUT', '/api/v1/admin/points/config', { token: adminUser.token, body: { code_vip_free: true } });
    }
    expect(await usable()).toBe(true);
  });

  it('para una cuenta, sin ficha y revocado', async () => {
    const code = await create({ reward: 'vip', days: 7, for_user: other.id });
    expect((await req('POST', '/api/v1/me/redeem', { token: player.token, body: { code } })).body.error.code).toBe('CODE_NOT_FOR_YOU');
    expect((await req('POST', '/api/v1/me/redeem', { token: noPlayer.token, body: { code } })).body.error.code).toBe('CODE_NO_PLAYER');
    const ok = await req('POST', '/api/v1/me/redeem', { token: other.token, body: { code } });
    expect(ok.body).toMatchObject({ reward: 'vip', days: 7 });
    const revoked = await create({ reward: 'points', amount: 5 });
    expect((await req('POST', `/api/v1/admin/codes/${codeIds.at(-1)}/revoke`, { token: adminUser.token, body: { reason: 'se filtró' } })).status).toBe(204);
    const r = await req('POST', '/api/v1/me/redeem', { token: other.token, body: { code: revoked } });
    expect(r.status).toBe(404);
    expect(r.body.error).toMatchObject({ code: 'CODE_INVALID', message: 'Ese código no es válido' });
  });

  it('la lista del admin, los canjes de un código y revertir', async () => {
    const list = await req('GET', '/api/v1/admin/codes?q=Prueba%20integraci%C3%B3n&per=50', { token: adminUser.token });
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThanOrEqual(4);
    const pts = list.body.items.find((x: { prize: { amount: number } }) => x.prize.amount === 700);
    expect(pts).toMatchObject({ uses: 1, max_uses: 1, state: 'used_up', prize: { reward: 'points' } });
    expect(list.body.items.find((x: { state: string }) => x.state === 'revoked')).toBeTruthy();

    const reds = await req('GET', `/api/v1/admin/codes/${pts.id}/redemptions`, { token: adminUser.token });
    expect(reds.body.items).toHaveLength(1);
    expect(reds.body.items[0].account.id).toBe(player.id);
    const rev = await req('POST', `/api/v1/admin/redemptions/${reds.body.items[0].id}/revert`, { token: adminUser.token, body: { reason: 'prueba' } });
    expect(rev.status).toBe(204);
    expect((await req('GET', '/api/v1/me/points', { token: player.token })).body.points.granted).toBe(0);
    const twice = await req('POST', `/api/v1/admin/redemptions/${reds.body.items[0].id}/revert`, { token: adminUser.token, body: { reason: 'prueba' } });
    expect(twice.body.error).toMatchObject({ code: 'BUSINESS_RULE', message: 'Ese canje ya se revirtió' });

    const mine = await req('GET', '/api/v1/me/redemptions', { token: player.token });
    expect(mine.body.items.find((x: { amount: number }) => x.amount === 700)).toMatchObject({ reward: 'points' });
    expect(mine.body.items.find((x: { amount: number }) => x.amount === 700).reverted_at).not.toBeNull();
    expect(mine.body.items.every((x: { code_tail: string }) => x.code_tail.length === 4)).toBe(true);
  });

  it('5 códigos que no existen bloquean la cuenta 15 minutos', async () => {
    const req2 = client(createApp());
    await admin().from('redeem_attempts' as never).delete().eq('user_id', other.id);
    for (let i = 1; i <= 5; i++) {
      expect((await req2('POST', '/api/v1/me/redeem', { token: other.token, body: { code: `NOEXISTE${i}` } })).body.error.code).toBe('CODE_INVALID');
    }
    const r = await req2('POST', '/api/v1/me/redeem', { token: other.token, body: { code: 'NOEXISTE6' } });
    expect(r.status).toBe(429);
    expect(Number(r.headers.get('Retry-After'))).toBeGreaterThan(890);
    const att = await req2('GET', '/api/v1/admin/codes/attempts', { token: adminUser.token });
    expect(att.body.blocked.some((b: { account: { id: string } }) => b.account.id === other.id)).toBe(true);
    expect((await req2('GET', '/api/v1/admin/codes/attempts', { token: other.token })).status).toBe(403);
  });
});
