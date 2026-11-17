import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { weeklyEnds } from '../../src/routes/shop';
import { AdminShopItemPatch, EquipPatch, PlayerCosmeticsQuery, PointsGrant } from '../../src/schemas/shop';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Tienda (replanteo 113, bitácora docs/bitacora/2026-11-11-tienda-de-puntos) con PostgREST simulado (sin Docker). Las
// reglas (saldo, lock por cuenta, lo VIP con VIP, quién ve qué) las prueba la base: pruebas/probar_113.sql.
const USER = '77777777-7777-4777-8777-777777777777';
const TARGET = '88888888-8888-4888-8888-888888888888';
const PLAYER = 'dddddddd-0000-4000-8000-000000000001';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null };
function postgrest(role: 'admin' | 'user', handler: (url: URL, method: string) => Response | undefined) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const raw = String(input instanceof Request ? input.url : input);
      const method = (input instanceof Request ? input.method : init.method) ?? 'GET';
      calls.push({ method, url: decodeURIComponent(raw), body: typeof init.body === 'string' ? init.body : null });
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      const url = new URL(raw);
      if (url.pathname.endsWith('/profiles') && url.searchParams.get('select') === 'role') return Response.json([{ role }]);
      return handler(url, method) ?? new Response('no simulado: ' + raw, { status: 599 });
    }),
  );
  return calls;
}
const call = async (method: string, path: string, body?: unknown, auth = true) =>
  makeApp().request(
    path,
    {
      method,
      headers: {
        ...(auth ? { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } : {}),
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    testEnv(),
  );
const rpcBody = (calls: Call[], fn: string) => JSON.parse(calls.find((x) => x.url.includes(`/rpc/${fn}`))!.body!);
const restUrl = (calls: Call[], table: string) => calls.find((x) => x.url.includes(`/rest/v1/${table}?`))!.url;

const item = (o: Record<string, unknown> = {}) => ({
  id: 'marco-mira', kind: 'frame', name: 'Mira', description: 'Esquinas tácticas', file: 'marcos/mira.svg', css_class: null,
  vip_only: false, vip_reward: false, animated: true, collection: 'cs', base_price: 1200, price: 1200, vip_price: null, weekly: false, sort: 10, ...o,
});
const listed = (rows: unknown[]) =>
  new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json', 'Content-Range': `0-${rows.length - 1}/${rows.length}` } });

describe('esquemas', () => {
  it('equipar: al menos un cambio, hasta 3 stickers y null saca', () => {
    expect(EquipPatch.safeParse({}).success).toBe(false);
    expect(EquipPatch.safeParse({ frame: null }).success).toBe(true);
    expect(EquipPatch.safeParse({ stickers: ['a1', 'b2', 'c3'] }).success).toBe(true);
    expect(EquipPatch.safeParse({ stickers: ['a1', 'b2', 'c3', 'd4'] }).success).toBe(false);
    expect(EquipPatch.safeParse({ theme: 'Tema Raro' }).success).toBe(false);
  });

  it('regalar puntos: distinto de 0, con motivo, y la moneda por defecto son puntos', () => {
    expect(PointsGrant.parse({ amount: -50, reason: 'corrección' })).toEqual({ amount: -50, reason: 'corrección', currency: 'points' });
    expect(PointsGrant.safeParse({ amount: 0, reason: 'x' }).success).toBe(false);
    expect(PointsGrant.safeParse({ amount: 10, reason: '  ' }).success).toBe(false);
    expect(PointsGrant.safeParse({ amount: 10, reason: 'x', currency: 'oro' }).success).toBe(false);
  });

  it('cambiar un artículo: al menos un campo; null saca el precio', () => {
    expect(AdminShopItemPatch.safeParse({}).success).toBe(false);
    expect(AdminShopItemPatch.safeParse({ price: null }).success).toBe(true);
    expect(AdminShopItemPatch.safeParse({ price: 0 }).success).toBe(false);
  });

  it('cosméticos por lotes: ids sin repetir, válidos y hasta 100', () => {
    expect(PlayerCosmeticsQuery.parse({ players: `${PLAYER}, ${PLAYER},${TARGET}` }).players).toEqual([PLAYER, TARGET]);
    expect(PlayerCosmeticsQuery.safeParse({ players: 'no-es-un-id' }).success).toBe(false);
    expect(PlayerCosmeticsQuery.safeParse({ players: ' , ' }).success).toBe(false);
    const many = Array.from({ length: 101 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`).join(',');
    expect(PlayerCosmeticsQuery.safeParse({ players: many }).success).toBe(false);
  });

  it('las ofertas cambian el lunes a las 00:00 de Argentina (03:00 UTC)', () => {
    expect(weeklyEnds(new Date('2026-11-12T15:00:00Z'))).toBe('2026-11-16T03:00:00.000Z'); // jueves
    expect(weeklyEnds(new Date('2026-11-16T02:59:00Z'))).toBe('2026-11-16T03:00:00.000Z'); // domingo 23:59 en Argentina
    expect(weeklyEnds(new Date('2026-11-16T03:00:00Z'))).toBe('2026-11-23T03:00:00.000Z'); // lunes 00:00 en Argentina
  });
});

describe('catálogo', () => {
  it('sin sesión: todo sin marcar, filtros y orden; owned pide sesión', async () => {
    const calls = postgrest('user', (url) => (url.pathname.endsWith('/shop_catalog') ? listed([item()]) : undefined));
    const res = await call('GET', '/api/v1/shop/items?kind=frame&vip=false&q=mi&sort=price&order=desc', undefined, false);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.items[0]).toMatchObject({ id: 'marco-mira', price: 1200, owned: false, usable: false, equipped: false });
    expect(body.weekly_ends).toMatch(/T03:00:00.000Z$/);
    const url = restUrl(calls, 'shop_catalog');
    expect(url).toContain('kind=eq.frame');
    expect(url).toContain('vip_only=eq.false');
    expect(url).toContain('name=ilike.%mi%');
    expect(url).toContain('order=price.desc.nullslast,vip_price.desc.nullslast,id.asc');
    expect((await call('GET', '/api/v1/shop/items?owned=true', undefined, false)).status).toBe(401);
  });

  it.each([true, false])(
    'con sesión: lo que tiene, lo que puede usar y lo puesto; el premio VIP cuenta como suyo si es VIP (lo VIP de un código sin VIP: %s)',
    async (codeVipFree) => {
      postgrest('user', (url) => {
        const p = url.pathname;
        if (p.endsWith('/shop_catalog'))
          return listed([
            item(),
            item({ id: 'sticker-vip', kind: 'sticker', vip_only: true, price: null, base_price: null, vip_price: 200 }),
            item({ id: 'sticker-sorteo', kind: 'sticker', vip_only: true, price: null, base_price: null, vip_price: 200 }),
            item({ id: 'marco-vip-oro', vip_only: true, vip_reward: true, price: null, base_price: null }),
          ]);
        if (p.endsWith('/user_items'))
          return Response.json([
            { item_id: 'marco-mira', source: 'purchase', expires_at: null },
            { item_id: 'sticker-vip', source: 'purchase', expires_at: null },
            { item_id: 'sticker-sorteo', source: 'code', expires_at: null },
          ]);
        if (p.endsWith('/vip_status')) return Response.json([]);
        if (p.endsWith('/points_config')) return Response.json({ code_vip_free: codeVipFree });
        if (p.endsWith('/user_cosmetics')) return Response.json({ frame: 'marco-mira', background: null, theme: null, name: null, stickers: [] });
        return undefined;
      });
      const body = await json(await call('GET', '/api/v1/shop/items'));
      const by = Object.fromEntries(body.items.map((i: { id: string }) => [i.id, i]));
      expect(by['marco-mira']).toMatchObject({ owned: true, usable: true, equipped: true });
      // Lo VIP comprado, sin VIP hoy: lo tiene pero está congelado.
      expect(by['sticker-vip']).toMatchObject({ owned: true, usable: false, equipped: false });
      // Lo VIP de un código (replanteo 126): se usa sin VIP solo con code_vip_free encendido.
      expect(by['sticker-sorteo']).toMatchObject({ owned: true, usable: codeVipFree });
      expect(by['marco-vip-oro']).toMatchObject({ owned: false, usable: false });
    },
  );

  it('owned=true siendo VIP: lo suyo más el premio VIP', async () => {
    const calls = postgrest('user', (url) => {
      const p = url.pathname;
      if (p.endsWith('/shop_catalog')) return listed([]);
      if (p.endsWith('/user_items')) return Response.json([{ item_id: 'marco-mira', source: 'purchase', expires_at: null }]);
      if (p.endsWith('/points_config')) return Response.json({ code_vip_free: true });
      if (p.endsWith('/vip_status'))
        return Response.json([{ user_id: USER, active: true, lifetime: true, until: null, since: '2026-10-01T00:00:00Z' }]);
      if (p.endsWith('/user_cosmetics')) return Response.json(null);
      return undefined;
    });
    expect((await call('GET', '/api/v1/shop/items?owned=true')).status).toBe(200);
    expect(restUrl(calls, 'shop_catalog')).toContain('or=(vip_reward.eq.true,id.in.(marco-mira))');
  });
});

describe('la cuenta', () => {
  it('comprar llama a shop_buy y un error de la base es BUSINESS_RULE con su mensaje', async () => {
    let fail = false;
    const calls = postgrest('user', (url) => {
      if (!url.pathname.endsWith('/rpc/shop_buy')) return undefined;
      return fail
        ? Response.json({ code: 'P0001', message: 'Te faltan 300 puntos' }, { status: 400 })
        : Response.json({ item: 'marco-mira', price_paid: 900, currency: 'points', balance: 100 });
    });
    const ok = await call('POST', '/api/v1/shop/items/marco-mira/buy');
    expect(ok.status).toBe(200);
    expect(await json(ok)).toEqual({ item: 'marco-mira', price_paid: 900, currency: 'points', balance: 100 });
    expect(rpcBody(calls, 'shop_buy')).toEqual({ p_item: 'marco-mira' });
    fail = true;
    const res = await call('POST', '/api/v1/shop/items/marco-mira/buy');
    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({ error: { code: 'BUSINESS_RULE', message: 'Te faltan 300 puntos' } });
    expect((await call('POST', '/api/v1/shop/items/Marco Raro/buy')).status).toBe(400);
    expect((await call('POST', '/api/v1/shop/items/marco-mira/buy', undefined, false)).status).toBe(401);
  });

  it('mis puntos: points_summary de la propia cuenta', async () => {
    const summary = {
      vip: false, has_player: true,
      points: { earned: 40, granted: 0, spent: 30, balance: 10, mixes: 3 },
      vip_coins: { earned: 0, granted: 0, spent: 0, balance: 0, mixes: 0, frozen: true },
    };
    const calls = postgrest('user', (url) => (url.pathname.endsWith('/rpc/points_summary') ? Response.json(summary) : undefined));
    expect(await json(await call('GET', '/api/v1/me/points'))).toEqual(summary);
    expect(rpcBody(calls, 'points_summary')).toEqual({});
  });

  it('historial: la página va como límite y desplazamiento, con el total', async () => {
    const calls = postgrest('user', (url) =>
      url.pathname.endsWith('/rpc/points_history')
        ? Response.json([{ kind: 'mm', at: '2026-11-11T00:00:00Z', amount: 15, label: 'dust2 · victoria', ref: PLAYER, total: 41 }])
        : undefined,
    );
    const body = await json(await call('GET', '/api/v1/me/points/history?currency=vip&page=3&per=20'));
    expect(body).toMatchObject({ total: 41, page: 3, per: 20, sort: 'at', order: 'desc' });
    expect(body.items[0]).toEqual({ kind: 'mm', at: '2026-11-11T00:00:00Z', amount: 15, label: 'dust2 · victoria', ref: PLAYER });
    expect(rpcBody(calls, 'points_history')).toEqual({ p_currency: 'vip', p_limit: 20, p_offset: 40 });
  });

  it('equipar manda solo lo que cambia; sin nada equipado, todo vacío', async () => {
    const calls = postgrest('user', (url) => {
      if (url.pathname.endsWith('/rpc/set_my_cosmetics'))
        return Response.json({ frame: null, background: null, theme: 'tema-x', name: null, stickers: [] });
      if (url.pathname.endsWith('/user_cosmetics')) return new Response('', { status: 406, headers: { 'Content-Type': 'application/json' } });
      return undefined;
    });
    expect((await call('PUT', '/api/v1/me/cosmetics', { theme: 'tema-x', frame: null })).status).toBe(200);
    expect(rpcBody(calls, 'set_my_cosmetics')).toEqual({ p_data: { theme: 'tema-x', frame: null } });
    expect((await call('PUT', '/api/v1/me/cosmetics', {})).status).toBe(400);
  });
});

describe('cosméticos de varias fichas', () => {
  it('pide las fichas a player_cosmetics_public y devuelve cada una resuelta', async () => {
    const frame = { id: 'marco-mira', kind: 'frame', name: 'Mira', file: 'marcos/mira.svg', css_class: null, animated: true, vip_only: false };
    const calls = postgrest('user', (url) =>
      url.pathname.endsWith('/player_cosmetics_public')
        ? Response.json([{ player_id: PLAYER, vip: true, frame, background: null, theme: null, name: null, stickers: [] }])
        : undefined,
    );
    const body = await json(await call('GET', `/api/v1/cosmetics?players=${PLAYER},${TARGET}`, undefined, false));
    expect(body.items).toEqual([{ player_id: PLAYER, vip: true, frame, avatar: null, name: null, background: null, theme: null, stickers: [] }]);
    expect(restUrl(calls, 'player_cosmetics_public')).toContain(`player_id=in.(${PLAYER},${TARGET})`);
  });
});

describe('admin', () => {
  it('solo admins', async () => {
    postgrest('user', () => undefined);
    expect((await call('GET', '/api/v1/admin/shop/items')).status).toBe(403);
    expect((await call('PUT', '/api/v1/admin/points/config', { per_mix: 20 })).status).toBe(403);
    expect((await call('POST', `/api/v1/admin/users/${TARGET}/points`, { amount: 10, reason: 'x' })).status).toBe(403);
  });

  it('cuentas: orden, búsqueda y página a admin_points_accounts, con el total', async () => {
    const calls = postgrest('admin', (url) =>
      url.pathname.endsWith('/rpc/admin_points_accounts')
        ? Response.json([{
            user_id: TARGET, alias: 'kyan', player_id: PLAYER, nick: 'kyan', vip: true, earned: 510, granted: 0, spent: 0, balance: 510, mixes: 39,
            vip_earned: 100, vip_granted: 0, vip_spent: 0, vip_balance: 100, items: 0, cover_url: null, total: 144,
          }])
        : undefined,
    );
    const body = await json(await call('GET', '/api/v1/admin/points/accounts?q=ky&vip=true&sort=mixes&order=asc&page=2&per=10'));
    expect(body.total).toBe(144);
    expect(body.items[0]).toEqual({
      user: { id: TARGET, alias: 'kyan' }, player: { id: PLAYER, alias: 'kyan' }, vip: true,
      points: { earned: 510, granted: 0, spent: 0, balance: 510, mixes: 39 },
      vip_coins: { earned: 100, granted: 0, spent: 0, balance: 100 }, items: 0, cover_url: null,
    });
    expect(rpcBody(calls, 'admin_points_accounts')).toEqual({ p_q: 'ky', p_vip: true, p_sort: 'mixes:asc', p_limit: 10, p_offset: 10 });
  });

  it('regalar puntos: 404 si la cuenta no existe; si existe, admin_points_grant y el saldo nuevo', async () => {
    let exists = false;
    const calls = postgrest('admin', (url) => {
      const p = url.pathname;
      if (p.endsWith('/admin_user_list')) return Response.json(exists ? [{ id: TARGET }] : []);
      if (p.endsWith('/rpc/admin_points_grant')) return Response.json('0c0c0c0c-0000-4000-8000-000000000001');
      if (p.endsWith('/rpc/points_summary')) return Response.json({ vip: false, has_player: true, points: {}, vip_coins: {} });
      return undefined;
    });
    expect((await call('POST', `/api/v1/admin/users/${TARGET}/points`, { amount: 10, reason: 'premio' })).status).toBe(404);
    exists = true;
    expect((await call('POST', `/api/v1/admin/users/${TARGET}/points`, { amount: -5, reason: 'corrección', currency: 'vip' })).status).toBe(200);
    expect(rpcBody(calls, 'admin_points_grant')).toEqual({ p_user: TARGET, p_amount: -5, p_reason: 'corrección', p_currency: 'vip' });
    expect(rpcBody(calls, 'points_summary')).toEqual({ p_user: TARGET });
  });

  it('quitar un artículo responde 204 y cambiar uno devuelve cuántos lo tienen', async () => {
    const calls = postgrest('admin', (url) => {
      const p = url.pathname;
      if (p.endsWith('/admin_user_list')) return Response.json([{ id: TARGET }]);
      if (p.includes('/rpc/')) return Response.json(null);
      if (p.endsWith('/shop_items'))
        return Response.json({
          id: 'marco-mira', kind: 'frame', name: 'Mira', description: null, file: 'marcos/mira.svg', css_class: null, collection: 'cs',
          animated: true, vip_only: false, vip_reward: false, price: 999, vip_price: null, active: true, sort: 10, user_items: [{ count: 4 }],
        });
      return undefined;
    });
    expect((await call('POST', `/api/v1/admin/users/${TARGET}/items/marco-mira/revoke`, { reason: 'trampa' })).status).toBe(204);
    expect(rpcBody(calls, 'admin_item_revoke')).toEqual({ p_user: TARGET, p_item: 'marco-mira', p_reason: 'trampa' });
    const res = await call('PATCH', '/api/v1/admin/shop/items/marco-mira', { price: 999 });
    expect(await json(res)).toMatchObject({ id: 'marco-mira', price: 999, owners: 4 });
    expect(rpcBody(calls, 'admin_shop_item_update')).toEqual({ p_item: 'marco-mira', p_changes: { price: 999 } });
  });
});
