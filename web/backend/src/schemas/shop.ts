import { z } from '@hono/zod-openapi';

// Economía de puntos, tienda e inventario (replanteo 110, planes docs/bitacora/2026-11-11-economia-puntos y
// docs/bitacora/2026-11-11-tienda).

export const Currency = z.enum(['points', 'vip']).openapi({ description: '`points` (todos) o `vip` (monedas VIP)' });
const Kind = z.enum(['frame', 'sticker', 'theme', 'name', 'background']);

export const ShopItem = z
  .object({
    id: z.string(),
    kind: Kind,
    name: z.string(),
    description: z.string().nullable(),
    file: z.string().nullable().openapi({ description: 'SVG en /cosmetics/ (marcos, stickers y fondos)' }),
    css_class: z.string().nullable().openapi({ description: 'Clase de cosmeticos.css (temas y nombres)' }),
    vip_only: z.boolean(),
    vip_reward: z.boolean().openapi({ description: 'Viene con el VIP: no se compra (el Marco Oro VIP)' }),
    animated: z.boolean(),
    collection: z.string(),
    theme: z.string().openapi({ description: 'Clave del pack: el id sin el prefijo del tipo (pais-ar, serie-ninja…)' }),
    base_price: z.number().int().nullable().openapi({ description: 'Precio en puntos sin la oferta' }),
    price: z.number().int().nullable().openapi({ description: 'Precio en puntos de hoy; `null` si no se vende por puntos' }),
    vip_price: z.number().int().nullable().openapi({ description: 'Precio en monedas VIP (solo lo VIP)' }),
    weekly: z.boolean().openapi({ description: 'En oferta esta semana' }),
  })
  .openapi('ShopItem');

export const ShopCatalog = z
  .object({
    items: z.array(ShopItem),
    weekly_ends: z.string().openapi({ description: 'Cuándo cambian las ofertas (lunes 00:00 de Bogotá)' }),
    weekly_discount: z.number().int(),
    bundle_discount: z.number().int().openapi({ description: 'Descuento de un pack sobre lo que falta' }),
  })
  .openapi('ShopCatalog');

export const EconomyRule = z
  .object({
    key: z.string().openapi({ description: 'match, match_win, first_of_day, official, medal_oro, season_10, tournament_1…' }),
    points: z.number().int(),
    vip_coins: z.number().int(),
    enabled: z.boolean(),
  })
  .openapi('EconomyRule');

export const Economy = z
  .object({
    rules: z.array(EconomyRule),
    daily_match_cap: z.number().int(),
    weekly_count: z.number().int(),
    weekly_discount: z.number().int(),
    bundle_discount: z.number().int(),
    starts_at: z.string().openapi({ description: 'Desde cuándo se dan premios' }),
  })
  .openapi('Economy');

export const Wallet = z
  .object({
    points: z.number().int(),
    vip_coins: z.number().int(),
    vip: z.boolean().openapi({ description: 'Es VIP hoy. Si no, las monedas VIP están congeladas' }),
    matches_today: z.number().int().openapi({ description: 'Partidas que ya dieron premio hoy' }),
    daily_match_cap: z.number().int(),
  })
  .openapi('Wallet');

export const LedgerRow = z
  .object({
    id: z.number().int(),
    created_at: z.string(),
    currency: Currency,
    amount: z.number().int().openapi({ description: 'Positivo: premio o regalo. Negativo: compra o corrección' }),
    source: z.string().openapi({ description: 'match, medal, season, grant, purchase…' }),
    ref: z.string(),
    label: z.string(),
  })
  .openapi('LedgerRow');
export const LedgerQuery = z.object({
  currency: Currency.optional(),
  before: z.coerce.number().int().min(1).optional().openapi({ description: 'Las filas con id menor (página siguiente)' }),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export const Ledger = z
  .object({ items: z.array(LedgerRow), next: z.number().int().nullable().openapi({ description: '`before` de la página siguiente' }) })
  .openapi('Ledger');

export const Equipped = z
  .object({
    frame: z.string().nullable(),
    theme: z.string().nullable(),
    name: z.string().nullable(),
    background: z.string().nullable(),
    stickers: z.array(z.string()).max(3),
  })
  .openapi('Equipped');

export const Inventory = z
  .object({
    items: z.array(
      z.object({
        item_id: z.string(),
        source: z.enum(['purchase', 'bundle', 'grant', 'vip']).openapi({ description: '`vip`: el premio VIP, mientras sea VIP' }),
        currency: Currency.nullable(),
        price_paid: z.number().int().nullable(),
        acquired_at: z.string().nullable(),
        usable: z.boolean().openapi({ description: 'false: es VIP y la cuenta no lo es hoy (congelado)' }),
        equipped: z.boolean(),
      }),
    ),
    equipped: Equipped,
    wishlist: z.array(z.string()),
  })
  .openapi('Inventory');

export const SetCosmetics = z
  .object({
    frame: z.string().nullable().optional(),
    theme: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    background: z.string().nullable().optional(),
    stickers: z.array(z.string().max(60)).max(3).optional(),
  })
  .openapi('SetCosmetics', { description: 'Lo que no viene no se toca; `null` lo saca' });

export const BuyItem = z.object({ item: z.string().min(2).max(60) }).openapi('BuyItem');
export const BuyBundle = z.object({ theme: z.string().min(2).max(60) }).openapi('BuyBundle');
export const Purchase = z
  .object({
    currency: Currency,
    price_paid: z.number().int(),
    balance: z.number().int().openapi({ description: 'Saldo de esa moneda después de la compra' }),
    items: z.number().int().openapi({ description: 'Artículos que entraron al inventario' }),
    full: z.number().int().nullable().openapi({ description: 'En un pack: lo que costaba sin descuento' }),
  })
  .openapi('Purchase');

export const WishParam = z.object({ item: z.string().min(2).max(60) });
export const WishToggled = z.object({ on: z.boolean() }).openapi('WishToggled');

export const PlayerCosmetics = Equipped.extend({ vip: z.boolean() }).openapi('PlayerCosmetics');

// ---------- Admin ----------
export const AdminGrant = z
  .object({
    user: z.uuid(),
    currency: Currency,
    amount: z.number().int().min(-1_000_000).max(1_000_000).refine((v) => v !== 0, 'No puede ser 0'),
    reason: z.string().trim().min(1).max(200),
  })
  .openapi('AdminPointsGrant');
export const AdminEconomy = z
  .object({
    daily_match_cap: z.number().int().min(0).max(100),
    weekly_count: z.number().int().min(0).max(24),
    weekly_discount: z.number().int().min(0).max(90),
    bundle_discount: z.number().int().min(0).max(90),
  })
  .openapi('AdminEconomy');
export const RuleParam = z.object({ key: z.string().regex(/^[a-z0-9_]{2,40}$/) });
export const AdminRule = z
  .object({
    points: z.number().int().min(0).max(100_000).optional(),
    vip_coins: z.number().int().min(0).max(100_000).optional(),
    enabled: z.boolean().optional(),
  })
  .openapi('AdminEconomyRule');
export const ItemParam = z.object({ id: z.string().min(2).max(60) });
export const AdminItemPatch = z
  .object({
    price: z.number().int().min(1).max(1_000_000).optional().openapi({ description: 'En puntos, o en monedas VIP si el artículo es VIP' }),
    no_price: z.boolean().optional().openapi({ description: 'Lo saca de la venta' }),
    active: z.boolean().optional(),
  })
  .openapi('AdminShopItemPatch');
export const AdminItemGrant = z.object({ item: z.string().min(2).max(60), note: z.string().max(200).optional() }).openapi('AdminItemGrant');
export const AdminItemRevoke = z.object({ reason: z.string().trim().min(1).max(200) }).openapi('AdminItemRevoke');
export const UserItemParam = z.object({ id: z.uuid(), item: z.string().min(2).max(60) });
export const AdminWalletQuery = z.object({
  q: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per: z.coerce.number().int().min(1).max(100).default(20),
});
export const AdminWallets = z
  .object({
    items: z.array(
      z.object({
        user_id: z.uuid(),
        alias: z.string().nullable(),
        player_id: z.uuid().nullable(),
        nick: z.string().nullable(),
        vip: z.boolean(),
        points: z.number().int(),
        vip_coins: z.number().int(),
        earned: z.number().int(),
        spent: z.number().int(),
        items: z.number().int(),
      }),
    ),
    total: z.number().int(),
    page: z.number().int(),
    per: z.number().int(),
  })
  .openapi('AdminWallets');
