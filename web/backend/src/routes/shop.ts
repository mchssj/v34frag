import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { optionalUser, requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave } from '../lib/db';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { IdParam as UserIdParam } from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';
import { IdParam } from '../schemas/players';
import {
  AdminEconomy,
  AdminGrant,
  AdminItemGrant,
  AdminItemPatch,
  AdminItemRevoke,
  AdminRule,
  AdminWalletQuery,
  AdminWallets,
  BuyBundle,
  BuyItem,
  Economy,
  Inventory,
  ItemParam,
  Ledger,
  LedgerQuery,
  PlayerCosmetics,
  Purchase,
  RuleParam,
  SetCosmetics,
  ShopCatalog,
  UserItemParam,
  Wallet,
  WishParam,
  WishToggled,
} from '../schemas/shop';
import { resolvePlayer } from '../services/players';

// Economía de puntos, tienda e inventario (replanteo 110, planes docs/bitacora/2026-11-11-economia-puntos y
// docs/bitacora/2026-11-11-tienda). Las reglas (saldo, VIP, tope, precios) las valida la base; acá solo se traduce.
// Las funciones del 110 todavía no están en src/db/types.ts: se llaman con `as never`, como en bookings.ts.

type C = Context<AppEnv>;
const rpc = async (c: C, fn: string, args: Record<string, unknown> = {}): Promise<unknown> =>
  must(await c.var.sb.rpc(fn as never, args as never));
const from = (c: C, table: string) => c.var.sb.from(table as never);

const ITEM_FIELDS = 'id, kind, name, description, file, css_class, vip_only, vip_reward, animated, collection, theme, base_price, price, vip_price, weekly, weekly_ends';
const NO_EQUIP = { frame: null, theme: null, name: null, background: null, stickers: [] as string[] };

// ---------- Público ----------
const catalog = createRoute({
  method: 'get', path: '/api/v1/shop/catalog', tags: ['Tienda'], middleware: [optionalUser] as const, summary: 'Catálogo de la tienda',
  description: 'Lo que está a la venta con el precio de hoy (ofertas de la semana incluidas), lo VIP con su precio en monedas VIP y la clave de pack (`theme`).',
  responses: { 200: { description: 'Catálogo', ...json(ShopCatalog) } },
});
const economy = createRoute({
  method: 'get', path: '/api/v1/shop/economy', tags: ['Tienda'], middleware: [optionalUser] as const, summary: 'Cómo se ganan los puntos',
  description: 'Cuánto da cada premio en puntos y monedas VIP, el tope de partidas por día y los descuentos.',
  responses: { 200: { description: 'Economía', ...json(Economy) } },
});
const playerCosmetics = createRoute({
  method: 'get', path: '/api/v1/players/{id}/cosmetics', tags: ['Jugadores'], middleware: [optionalUser] as const,
  summary: 'Lo que tiene puesto un jugador',
  description: 'Marco, tema, nombre, fondo y stickers de la ficha, sin lo VIP si la cuenta ya no es VIP. Sin cuenta o sin nada: todo vacío.',
  request: { params: IdParam },
  responses: { 200: { description: 'Cosméticos', ...json(PlayerCosmetics) }, ...errorResponses(404) },
});

// ---------- Cuenta ----------
const wallet = createRoute({
  method: 'get', path: '/api/v1/me/wallet', tags: ['Tienda'], security: bearer, middleware: [requireUser] as const,
  summary: 'Mi billetera', description: 'Puntos, monedas VIP (congeladas si no es VIP) y partidas que ya dieron premio hoy.',
  responses: { 200: { description: 'Billetera', ...json(Wallet) }, ...errorResponses(401) },
});
const ledger = createRoute({
  method: 'get', path: '/api/v1/me/ledger', tags: ['Tienda'], security: bearer, middleware: [requireUser] as const,
  summary: 'Mi historial de puntos', description: 'Premios, regalos y compras, lo más nuevo primero. Se pagina con `before`.',
  request: { query: LedgerQuery },
  responses: { 200: { description: 'Historial', ...json(Ledger) }, ...errorResponses(400, 401) },
});
const inventory = createRoute({
  method: 'get', path: '/api/v1/me/inventory', tags: ['Tienda'], security: bearer, middleware: [requireUser] as const,
  summary: 'Mi inventario', description: 'Lo que tengo (con el premio VIP si soy VIP), si lo puedo usar, lo que tengo puesto y mi lista de deseos.',
  responses: { 200: { description: 'Inventario', ...json(Inventory) }, ...errorResponses(401) },
});
const setCosmetics = createRoute({
  method: 'put', path: '/api/v1/me/cosmetics', tags: ['Tienda'], security: bearer, middleware: [requireUser] as const,
  summary: 'Equipar', description: 'Cambia lo puesto. Solo lo que tengo y puedo usar; hasta 3 stickers.',
  request: { body: { required: true, ...json(SetCosmetics) } },
  responses: { 200: { description: 'Lo puesto', ...json(z.object({ equipped: Inventory.shape.equipped })) }, ...errorResponses(400, 401, 403) },
});
const buy = createRoute({
  method: 'post', path: '/api/v1/shop/buy', tags: ['Tienda'], security: bearer, middleware: [requireUser] as const,
  summary: 'Comprar un artículo',
  description: 'Con puntos al precio de hoy; lo VIP, con monedas VIP y siendo VIP. Sin saldo: `BUSINESS_RULE`. Ya lo tiene: `CONFLICT`.',
  request: { body: { required: true, ...json(BuyItem) } },
  responses: { 200: { description: 'Compra', ...json(Purchase) }, ...errorResponses(400, 401, 403, 404, 409) },
});
const buyBundle = createRoute({
  method: 'post', path: '/api/v1/shop/buy-bundle', tags: ['Tienda'], security: bearer, middleware: [requireUser] as const,
  summary: 'Comprar un pack', description: 'Lo que falta de un pack (`theme`), con el descuento de los packs. Todo en una moneda.',
  request: { body: { required: true, ...json(BuyBundle) } },
  responses: { 200: { description: 'Compra', ...json(Purchase) }, ...errorResponses(400, 401, 403, 404, 409) },
});
const wish = createRoute({
  method: 'post', path: '/api/v1/me/wishlist/{item}', tags: ['Tienda'], security: bearer, middleware: [requireUser] as const,
  summary: 'Lista de deseos', description: 'Agrega o saca un artículo (hasta 100).',
  request: { params: WishParam },
  responses: { 200: { description: 'Estado', ...json(WishToggled) }, ...errorResponses(400, 401, 404) },
});

// ---------- Admin ----------
const adminWallets = createRoute({
  method: 'get', path: '/api/v1/admin/shop/wallets', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const, summary: 'Saldos',
  description: 'Cuentas con movimientos o inventario, de más puntos a menos.',
  request: { query: AdminWalletQuery },
  responses: { 200: { description: 'Saldos', ...json(AdminWallets) }, ...errorResponses(400, 401, 403) },
});
const adminGrant = createRoute({
  method: 'post', path: '/api/v1/admin/shop/grant', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const, summary: 'Dar o corregir puntos',
  description: 'Suma o resta puntos o monedas VIP con motivo. Queda en el historial de la cuenta.',
  request: { body: { required: true, ...json(AdminGrant) } },
  responses: { 200: { description: 'Billetera de la cuenta', ...json(z.object({ id: z.number().int() })) }, ...errorResponses(400, 401, 403, 404) },
});
const adminEconomy = createRoute({
  method: 'put', path: '/api/v1/admin/shop/economy', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const, summary: 'Topes y descuentos',
  description: 'Rige desde ahora: no le cambia el saldo a nadie hacia atrás.',
  request: { body: { required: true, ...json(AdminEconomy) } },
  responses: { 200: { description: 'Economía', ...json(Economy) }, ...errorResponses(400, 401, 403) },
});
const adminRule = createRoute({
  method: 'put', path: '/api/v1/admin/shop/economy/rules/{key}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const, summary: 'Cambiar un premio',
  request: { params: RuleParam, body: { required: true, ...json(AdminRule) } },
  responses: { 200: { description: 'Economía', ...json(Economy) }, ...errorResponses(400, 401, 403, 404) },
});
const adminItem = createRoute({
  method: 'patch', path: '/api/v1/admin/shop/items/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const, summary: 'Precio o activo de un artículo',
  request: { params: ItemParam, body: { required: true, ...json(AdminItemPatch) } },
  responses: { 204: { description: 'Guardado' }, ...errorResponses(400, 401, 403, 404) },
});
const adminItemGrant = createRoute({
  method: 'post', path: '/api/v1/admin/users/{id}/items', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const, summary: 'Regalar un artículo',
  description: 'También uno VIP (se usa mientras la cuenta sea VIP). El premio VIP no se regala.',
  request: { params: UserIdParam, body: { required: true, ...json(AdminItemGrant) } },
  responses: { 204: { description: 'Regalado' }, ...errorResponses(400, 401, 403, 404, 409) },
});
const adminItemRevoke = createRoute({
  method: 'delete', path: '/api/v1/admin/users/{id}/items/{item}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const, summary: 'Quitar un artículo',
  description: 'Del inventario y de lo puesto, con motivo. No devuelve puntos.',
  request: { params: UserItemParam, body: { required: true, ...json(AdminItemRevoke) } },
  responses: { 204: { description: 'Quitado' }, ...errorResponses(400, 401, 403, 404) },
});

type Rule = { key: string; points: number; vip_coins: number; enabled: boolean };
type Cfg = { daily_match_cap: number; weekly_count: number; weekly_discount: number; bundle_discount: number; starts_at: string };
async function readEconomy(c: C) {
  const [rules, cfg] = await Promise.all([
    from(c, 'economy_rules').select('key, points, vip_coins, enabled').order('sort' as never).then(mustHave),
    from(c, 'economy_config').select('daily_match_cap, weekly_count, weekly_discount, bundle_discount, starts_at').single().then(mustHave),
  ]);
  return { rules: rules as unknown as Rule[], ...(cfg as unknown as Cfg) };
}

type Purchased = { currency: 'points' | 'vip'; price_paid: number; balance: number; items?: number; full?: number };

export const shop = createRouter()
  .openapi(catalog, async (c) => {
    const [rows, cfg] = await Promise.all([
      from(c, 'shop_catalog').select(ITEM_FIELDS).order('sort' as never).then(mustHave),
      from(c, 'economy_config').select('weekly_discount, bundle_discount').single().then(mustHave),
    ]);
    const items = rows as unknown as (z.infer<typeof ShopCatalog>['items'][number] & { weekly_ends: string })[];
    const conf = cfg as unknown as { weekly_discount: number; bundle_discount: number };
    return c.json(
      {
        items: items.map(({ weekly_ends: _, ...i }) => i),
        weekly_ends: items[0]?.weekly_ends ?? new Date().toISOString(),
        weekly_discount: conf.weekly_discount,
        bundle_discount: conf.bundle_discount,
      },
      200,
    );
  })
  .openapi(economy, async (c) => c.json(await readEconomy(c), 200))
  .openapi(playerCosmetics, async (c) => {
    const id = await resolvePlayer(c.var.sb, c.req.valid('param').id);
    const row = must(await from(c, 'player_cosmetics_public').select('vip, frame, theme, name, background, stickers').eq('player_id' as never, id as never).maybeSingle());
    return c.json(row ? (row as unknown as z.infer<typeof PlayerCosmetics>) : { ...NO_EQUIP, vip: false }, 200);
  })
  .openapi(wallet, async (c) => c.json((await rpc(c, 'my_wallet')) as z.infer<typeof Wallet>, 200))
  .openapi(ledger, async (c) => {
    const q = c.req.valid('query');
    const rows = (await rpc(c, 'my_ledger', { p_currency: q.currency ?? null, p_before: q.before ?? null, p_limit: q.limit })) as z.infer<typeof Ledger>['items'];
    return c.json({ items: rows, next: rows.length === q.limit ? (rows.at(-1)?.id ?? null) : null }, 200);
  })
  .openapi(inventory, async (c) => {
    const uid = c.var.user!.id;
    const [items, eq, wishes] = await Promise.all([
      rpc(c, 'my_inventory'),
      from(c, 'user_cosmetics').select('frame, theme, name, background, stickers').eq('user_id' as never, uid as never).maybeSingle().then(must),
      from(c, 'user_wishlist').select('item_id').eq('user_id' as never, uid as never).order('created_at' as never).then(mustHave),
    ]);
    return c.json(
      {
        items: items as z.infer<typeof Inventory>['items'],
        equipped: (eq as z.infer<typeof Inventory>['equipped'] | null) ?? NO_EQUIP,
        wishlist: (wishes as unknown as { item_id: string }[]).map((w) => w.item_id),
      },
      200,
    );
  })
  .openapi(setCosmetics, async (c) => {
    const equipped = (await rpc(c, 'set_my_cosmetics', { p_data: c.req.valid('json') })) as z.infer<typeof Inventory>['equipped'];
    return c.json({ equipped }, 200);
  })
  .openapi(buy, async (c) => {
    const r = (await rpc(c, 'shop_buy', { p_item: c.req.valid('json').item })) as Purchased;
    return c.json({ currency: r.currency, price_paid: r.price_paid, balance: r.balance, items: 1, full: null }, 200);
  })
  .openapi(buyBundle, async (c) => {
    const r = (await rpc(c, 'shop_buy_bundle', { p_theme: c.req.valid('json').theme })) as Purchased;
    return c.json({ currency: r.currency, price_paid: r.price_paid, balance: r.balance, items: r.items ?? 0, full: r.full ?? null }, 200);
  })
  .openapi(wish, async (c) => c.json({ on: (await rpc(c, 'wishlist_toggle', { p_item: c.req.valid('param').item })) as boolean }, 200))
  .openapi(adminWallets, async (c) => {
    const q = c.req.valid('query');
    const rows = (await rpc(c, 'admin_wallets', { p_q: q.q?.trim() || null, p_limit: q.per, p_offset: (q.page - 1) * q.per })) as (z.infer<
      typeof AdminWallets
    >['items'][number] & { total: number })[];
    return c.json({ items: rows.map(({ total: _, ...r }) => r), total: Number(rows[0]?.total ?? 0), page: q.page, per: q.per }, 200);
  })
  .openapi(adminGrant, async (c) => {
    const b = c.req.valid('json');
    const id = (await rpc(c, 'admin_points_grant', { p_user: b.user, p_currency: b.currency, p_amount: b.amount, p_reason: b.reason })) as number;
    return c.json({ id: Number(id) }, 200);
  })
  .openapi(adminEconomy, async (c) => {
    const b = c.req.valid('json');
    await rpc(c, 'admin_economy_set', {
      p_daily_match_cap: b.daily_match_cap, p_weekly_count: b.weekly_count, p_weekly_discount: b.weekly_discount, p_bundle_discount: b.bundle_discount,
    });
    return c.json(await readEconomy(c), 200);
  })
  .openapi(adminRule, async (c) => {
    const b = c.req.valid('json');
    await rpc(c, 'admin_economy_rule_set', {
      p_key: c.req.valid('param').key, p_points: b.points ?? null, p_vip_coins: b.vip_coins ?? null, p_enabled: b.enabled ?? null,
    });
    return c.json(await readEconomy(c), 200);
  })
  .openapi(adminItem, async (c) => {
    const b = c.req.valid('json');
    await rpc(c, 'admin_shop_item_update', { p_item: c.req.valid('param').id, p_price: b.price ?? null, p_active: b.active ?? null, p_no_price: b.no_price === true });
    return c.body(null, 204);
  })
  .openapi(adminItemGrant, async (c) => {
    const b = c.req.valid('json');
    await rpc(c, 'admin_item_grant', { p_user: c.req.valid('param').id, p_item: b.item, p_note: b.note ?? null });
    return c.body(null, 204);
  })
  .openapi(adminItemRevoke, async (c) => {
    const p = c.req.valid('param');
    await rpc(c, 'admin_item_revoke', { p_user: p.id, p_item: p.item, p_reason: c.req.valid('json').reason });
    return c.body(null, 204);
  });
