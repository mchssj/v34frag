import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Tienda contra la Supabase local con el replanteo 113 (bitácora docs/bitacora/2026-11-11-tienda-de-puntos).
const app = createApp();
const env = localEnv();
const steam = () => '7656119' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');

type Res = { status: number; body: any };
async function req(method: string, path: string, opts: { token?: string; body?: unknown; form?: FormData } = {}): Promise<Res> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await app.request(
    path,
    { method, headers, ...(opts.form ? { body: opts.form } : opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}) },
    env,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};

/** Un PNG con solo la cabecera: alcanza para el tipo y las medidas (el bucket no decodifica la imagen). */
function png(width: number, height: number): File {
  const b = new Uint8Array(64);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return new File([b], 'portada.png', { type: 'image/png' });
}

let adminUser: { id: string; token: string };
let player: { id: string; token: string };
let noPlayer: { id: string; token: string };
const playerId = crypto.randomUUID();
const sid = steam();
const matches: string[] = [];
let campPrice: number | null = null;

beforeAll(async () => {
  adminUser = await createUser({ role: 'admin' });
  player = await createUser();
  noPlayer = await createUser();
  const db = admin();
  check(await db.from('players').insert({ id: playerId, nick: `shop${playerId.slice(0, 6)}`, steam_id: sid, user_id: player.id }));
  // Dos mixes: uno ganado (15 puntos) y uno perdido (10).
  for (const [winner, elo] of [[1, 1015], [2, 1005]] as const) {
    const m = check(
      await db.from('matches').insert({
        kind: 'mix', status: 'finished', best_of: 1, side1_name: 'a', side2_name: 'b', map: 'de_nuke',
        played_at: new Date(Date.now() - 3600_000).toISOString(), score1: 13, score2: 7, winner_side: winner,
      }).select('id').single(),
    );
    matches.push(m.data!.id as string);
    check(await db.from('match_player_stats').insert({ match_id: m.data!.id, steam_id: sid, player_id: playerId, nick: 'x', team: 1, rounds: 20, elo_after: elo }));
  }
  campPrice = (check(await db.from('shop_items').select('price').eq('id', 'marco-camuflaje').single()).data as { price: number | null }).price;
  // Sin ofertas, para que el precio sea el de lista.
  check(await db.from('points_config').update({ weekly_count: 0 }).eq('id', 1));
});

afterAll(async () => {
  const db = admin();
  await db.from('points_config').update({ weekly_count: 6 }).eq('id', 1);
  await db.from('shop_items').update({ price: campPrice, active: true }).eq('id', 'marco-camuflaje');
  await db.from('user_cosmetics').delete().eq('user_id', player.id);
  await db.from('user_items').delete().eq('user_id', player.id);
  await db.from('point_grants').delete().eq('user_id', player.id);
  await db.from('notifications').delete().eq('user_id', player.id);
  await db.from('match_player_stats').delete().in('match_id', matches);
  await db.from('matches').delete().in('id', matches);
  await db.from('players').delete().eq('id', playerId);
});

describe('tienda', () => {
  it('los puntos salen de los mixes: 15 el ganado y 10 el perdido', async () => {
    const r = await req('GET', '/api/v1/me/points', { token: player.token });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ vip: false, has_player: true, points: { earned: 25, granted: 0, spent: 0, balance: 25, mixes: 2 } });
    expect(r.body.vip_coins).toMatchObject({ balance: 0, frozen: true });
    const h = await req('GET', '/api/v1/me/points/history', { token: player.token });
    expect(h.body.total).toBe(2);
    expect(h.body.items.map((i: { amount: number }) => i.amount).sort()).toEqual([10, 15]);
    expect(h.body.items[0].label).toMatch(/^nuke/);
  });

  it('sin saldo no compra; el admin regala puntos con aviso y entonces sí', async () => {
    const no = await req('POST', '/api/v1/shop/items/marco-camuflaje/buy', { token: player.token });
    expect(no.status).toBe(400);
    expect(no.body.error).toMatchObject({ code: 'BUSINESS_RULE' });
    expect(no.body.error.message).toMatch(/^Te faltan \d+ puntos$/);

    expect((await req('POST', `/api/v1/admin/users/${player.id}/points`, { token: player.token, body: { amount: 5000, reason: 'x' } })).status).toBe(403);
    const g = await req('POST', `/api/v1/admin/users/${player.id}/points`, { token: adminUser.token, body: { amount: 5000, reason: 'premio del torneo' } });
    expect(g.status).toBe(200);
    expect(g.body.points.balance).toBe(5025);
    const n = check(await admin().from('notifications').select('type, data').eq('user_id', player.id).eq('type', 'points_granted'));
    expect(n.data![0]!.data).toMatchObject({ amount: 5000, currency: 'points', reason: 'premio del torneo' });

    const b = await req('POST', '/api/v1/shop/items/marco-camuflaje/buy', { token: player.token });
    expect(b.status).toBe(200);
    expect(b.body).toEqual({ item: 'marco-camuflaje', price_paid: campPrice, currency: 'points', balance: 5025 - campPrice! });
    expect((await req('POST', '/api/v1/shop/items/marco-camuflaje/buy', { token: player.token })).body.error.message).toBe('Ya lo tienes');
  });

  it('lo VIP no se compra sin VIP, y sin ficha no se compra nada', async () => {
    const vipItem = check(await admin().from('shop_items').select('id').eq('vip_only', true).eq('vip_reward', false).limit(1).single()).data!.id;
    const r = await req('POST', `/api/v1/shop/items/${vipItem}/buy`, { token: player.token });
    expect(r.body.error.message).toBe('Los artículos VIP se compran siendo VIP');
    const s = await req('POST', '/api/v1/shop/items/marco-mira/buy', { token: noPlayer.token });
    expect(s.body.error.message).toMatch(/ficha de jugador vinculada/);
  });

  it('el catálogo marca lo propio y owned filtra', async () => {
    const all = await req('GET', '/api/v1/shop/items?kind=frame&per=400', { token: player.token });
    expect(all.status).toBe(200);
    expect(all.body.items.find((i: { id: string }) => i.id === 'marco-camuflaje')).toMatchObject({ owned: true, usable: true, equipped: false });
    const mine = await req('GET', '/api/v1/shop/items?owned=true', { token: player.token });
    expect(mine.body.items.map((i: { id: string }) => i.id)).toEqual(['marco-camuflaje']);
    expect((await req('GET', '/api/v1/shop/items?owned=true')).status).toBe(401);
    const anon = await req('GET', '/api/v1/shop/items?per=5');
    expect(anon.body.total).toBeGreaterThan(300);
  });

  it('equipar se ve en la ficha, en Jugadores y en los cosméticos por lotes', async () => {
    const e = await req('PUT', '/api/v1/me/cosmetics', { token: player.token, body: { frame: 'marco-camuflaje' } });
    expect(e.status).toBe(200);
    expect(e.body.frame).toBe('marco-camuflaje');
    expect((await req('PUT', '/api/v1/me/cosmetics', { token: player.token, body: { name: 'marco-camuflaje' } })).status).toBe(400);

    const d = await req('GET', `/api/v1/players/${playerId}`);
    expect(d.body.cosmetics.frame).toMatchObject({ id: 'marco-camuflaje', file: 'marcos/camuflaje.svg' });
    const l = await req('GET', `/api/v1/players?q=${d.body.alias}`);
    expect(l.body.items.find((p: { id: string }) => p.id === playerId).cosmetics.frame.id).toBe('marco-camuflaje');
    const batch = await req('GET', `/api/v1/cosmetics?players=${playerId}`);
    expect(batch.body.items[0]).toMatchObject({ player_id: playerId, frame: { id: 'marco-camuflaje' } });
  });

  it('el admin cambia precios y quita el artículo (también de lo equipado), con aviso', async () => {
    const p = await req('PATCH', '/api/v1/admin/shop/items/marco-camuflaje', { token: adminUser.token, body: { price: 777 } });
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({ price: 777, owners: 1 });
    expect((await req('PATCH', '/api/v1/admin/shop/items/marco-vip-oro', { token: adminUser.token, body: { vip_price: 5 } })).status).toBe(400);

    const items = await req('GET', `/api/v1/admin/users/${player.id}/items`, { token: adminUser.token });
    expect(items.body.items[0]).toMatchObject({ item: { id: 'marco-camuflaje' }, source: 'purchase', currency: 'points' });
    expect((await req('POST', `/api/v1/admin/users/${player.id}/items/marco-camuflaje/revoke`, { token: adminUser.token, body: { reason: 'prueba' } })).status).toBe(204);
    expect((await req('GET', `/api/v1/players/${playerId}`)).body.cosmetics).toBeNull();
    expect((await req('GET', '/api/v1/me/cosmetics', { token: player.token })).body.frame).toBeNull();

    // El nick de una ficha con cuenta es el alias de la cuenta.
    const alias = (await req('GET', `/api/v1/players/${playerId}`)).body.alias as string;
    const acc = await req('GET', `/api/v1/admin/points/accounts?q=${alias}`, { token: adminUser.token });
    expect(acc.body.items[0]).toMatchObject({ user: { id: player.id }, points: { balance: 5025 - campPrice! } });
  });

  it('la portada: 3:1, se ve en la ficha y el admin la quita', async () => {
    for (const [w, h] of [[500, 500], [1200, 300]]) {
      const bad = new FormData();
      bad.append('file', png(w, h));
      expect((await req('POST', '/api/v1/me/cover', { token: player.token, form: bad })).status).toBe(400);
    }
    const f = new FormData();
    f.append('file', png(1200, 400));
    const up = await req('POST', '/api/v1/me/cover', { token: player.token, form: f });
    expect(up.status).toBe(200);
    expect(up.body.cover_url).toMatch(new RegExp(`/avatars/${player.id}/cover-\\d+\\.png$`));
    expect((await req('GET', `/api/v1/players/${playerId}`)).body.cover_url).toBe(up.body.cover_url);

    const cl = await req('POST', `/api/v1/admin/users/${player.id}/cover/clear`, { token: adminUser.token, body: { reason: 'imagen inapropiada' } });
    expect(cl.status).toBe(200);
    expect((await req('GET', `/api/v1/players/${playerId}`)).body.cover_url).toBeNull();
    expect((await req('DELETE', '/api/v1/me/cover', { token: player.token })).body).toEqual({ cover_url: null });
  });

  it('la configuración: pública para leer, solo el admin la cambia y cambia los saldos', async () => {
    expect((await req('GET', '/api/v1/shop/config')).body).toMatchObject({ per_mix: 10, per_win: 5 });
    expect((await req('PUT', '/api/v1/admin/points/config', { token: player.token, body: { per_mix: 20 } })).status).toBe(403);
    const c = await req('PUT', '/api/v1/admin/points/config', { token: adminUser.token, body: { per_mix: 20 } });
    try {
      expect(c.body.per_mix).toBe(20);
      expect((await req('GET', '/api/v1/me/points', { token: player.token })).body.points.earned).toBe(45);
    } finally {
      await req('PUT', '/api/v1/admin/points/config', { token: adminUser.token, body: { per_mix: 10 } });
    }
  });
});
