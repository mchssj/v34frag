import { createRoute } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { z } from '@hono/zod-openapi';
import { currentUser, optionalUser, requireAdmin, requireUser } from '../lib/auth';
import { inBackground } from '../lib/background';
import { must, mustHave, notFound } from '../lib/db';
import { AppError } from '../lib/errors';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import { serviceClient } from '../lib/supabase';
import type { AppEnv } from '../lib/types';
import { AVATAR_MAX_BYTES, checkShape, readImage, storageError, type ImageShape } from '../lib/uploads';
import { IdParam } from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  AdminAccountList,
  AdminAccountQuery,
  AdminShopItem,
  AdminShopItemList,
  AdminShopItemPatch,
  AdminShopItemQuery,
  BuyResult,
  COVER_HELP,
  CoverResult,
  CoverUpload,
  EquipPatch,
  Equipped,
  ItemGrant,
  ItemParam,
  PlayerCosmeticsList,
  PlayerCosmeticsQuery,
  Points,
  PointsConfig,
  PointsConfigPatch,
  PointsGrant,
  PointsHistory,
  PointsHistoryQuery,
  Reason,
  ShopItemList,
  ShopItemQuery,
  UserItem,
  UserItemList,
  UserItemParam,
  UserItemQuery,
} from '../schemas/shop';
import { cosmeticOf, cosmeticsRows, toFull } from '../services/shop';
import { userExists, vipStatusOf } from '../services/vip';

// Tienda de cosméticos con puntos y monedas VIP (replanteo 113, bitácora docs/bitacora/2026-11-11-tienda-de-puntos).
// Las reglas (saldo, lock por cuenta, lo VIP con VIP, el premio VIP, quién ve qué) las valida la base; acá se arman las
// respuestas. Los puntos no se anotan: points_summary y points_history los calculan de los mixes.

type C = Context<AppEnv>;
const tags = ['Tienda'];

// 3:1 desde el 2026-11-15 (bitácora 2026-11-15-portada-encuadre); las 4:1 ya subidas se siguen viendo.
const COVER_SHAPE: ImageShape = { what: 'La portada', ratio: 3, tolerance: 0.05, shape: 'de proporción 3:1', min: [900, 300], max: [2400, 800] };
const AVATARS = 'avatars';
const AVATAR_MARKER = `/storage/v1/object/public/${AVATARS}/`;

/** Texto para ilike sobre nombres con tildes: solo se sacan los comodines y lo que PostgREST interpreta. */
const nameTerm = (q: string | undefined) => (q ?? '').replace(/[%_*,()\\"]/g, ' ').replace(/\s+/g, ' ').trim() || null;

/** Próximo lunes 00:00 de Argentina (UTC−3, sin horario de verano): cuándo cambian las ofertas. */
export function weeklyEnds(now = new Date()): string {
  const art = new Date(now.getTime() - 3 * 3_600_000);
  const day = (art.getUTCDay() + 6) % 7; // 0 = lunes
  const monday = Date.UTC(art.getUTCFullYear(), art.getUTCMonth(), art.getUTCDate() - day + 7);
  return new Date(monday + 3 * 3_600_000).toISOString();
}

// ---------- rutas: catálogo y cosméticos públicos ----------

const items = createRoute({
  method: 'get', path: '/api/v1/shop/items', tags, middleware: [optionalUser] as const,
  summary: 'Catálogo de la tienda',
  description:
    'Los artículos activos con el precio de hoy (las ofertas de la semana ya descontadas). Sin sesión se ve todo; con sesión, ' +
    'cada artículo dice si lo tienes, si lo puedes usar y si lo tienes puesto. `owned` necesita sesión.',
  request: { query: ShopItemQuery },
  responses: { 200: { description: 'Catálogo', ...json(ShopItemList) }, ...errorResponses(400, 401) },
});
const config = createRoute({
  method: 'get', path: '/api/v1/shop/config', tags, middleware: [optionalUser] as const,
  summary: 'Cuánto se gana', description: 'Puntos y monedas VIP por mix y las ofertas de la semana. Sin sesión.',
  responses: { 200: { description: 'Configuración', ...json(PointsConfig) } },
});
const playerCosmetics = createRoute({
  method: 'get', path: '/api/v1/cosmetics', tags, middleware: [optionalUser] as const,
  summary: 'Cosméticos de varias fichas',
  description:
    'Lo equipado de hasta 100 fichas a la vez, para las listas que no lo traen (la sala del matchmaking, los amigos, el grupo). ' +
    'Sin lo que la cuenta ya no puede usar. Las fichas sin nada equipado no vienen. Sin sesión.',
  request: { query: PlayerCosmeticsQuery },
  responses: { 200: { description: 'Cosméticos', ...json(PlayerCosmeticsList) }, ...errorResponses(400) },
});

// ---------- rutas: la cuenta ----------

const buy = createRoute({
  method: 'post', path: '/api/v1/shop/items/{id}/buy', tags, security: bearer, middleware: [requireUser] as const,
  summary: 'Comprar',
  description:
    'Con puntos lo de todos; lo VIP, con monedas VIP y siendo VIP. Sin saldo, ya lo tienes, no se vende, el premio VIP o sin ficha ' +
    'vinculada: `BUSINESS_RULE` con el motivo.',
  request: { params: ItemParam },
  responses: { 200: { description: 'Compra hecha', ...json(BuyResult) }, ...errorResponses(400, 401) },
});
const myPoints = createRoute({
  method: 'get', path: '/api/v1/me/points', tags, security: bearer, middleware: [requireUser] as const,
  summary: 'Mis puntos y monedas VIP',
  description: 'Se calculan de los mixes y los mapas del matchmaking: si un admin borra un mix, se corrigen solos.',
  responses: { 200: { description: 'Saldo', ...json(Points) }, ...errorResponses(401) },
});
const myHistory = createRoute({
  method: 'get', path: '/api/v1/me/points/history', tags, security: bearer, middleware: [requireUser] as const,
  summary: 'Movimientos de mis puntos', description: 'De una moneda (`currency`), lo más nuevo primero.',
  request: { query: PointsHistoryQuery },
  responses: { 200: { description: 'Movimientos', ...json(PointsHistory) }, ...errorResponses(400, 401) },
});
const myCosmetics = createRoute({
  method: 'get', path: '/api/v1/me/cosmetics', tags, security: bearer, middleware: [requireUser] as const,
  summary: 'Lo que tengo puesto', responses: { 200: { description: 'Equipado', ...json(Equipped) }, ...errorResponses(401) },
});
const equip = createRoute({
  method: 'put', path: '/api/v1/me/cosmetics', tags, security: bearer, middleware: [requireUser] as const,
  summary: 'Equipar',
  description: 'Uno por tipo y hasta 3 stickers, de lo que tienes (lo VIP, siendo VIP). Lo que no viene no se toca; `null` lo saca.',
  request: { body: { required: true, ...json(EquipPatch) } },
  responses: { 200: { description: 'Equipado', ...json(Equipped) }, ...errorResponses(400, 401) },
});
const coverLimit = bodyLimit({
  maxSize: AVATAR_MAX_BYTES + 16 * 1024,
  onError: () => {
    throw new AppError(413, 'FILE_TOO_LARGE', 'La imagen pesa más de 1024 KB.');
  },
});
const uploadCover = createRoute({
  method: 'post', path: '/api/v1/me/cover', tags, security: bearer, middleware: [requireUser, coverLimit] as const,
  summary: 'Subir mi portada', description: `\`multipart/form-data\`, campo \`file\`. Reemplaza a la anterior. ${COVER_HELP}`,
  request: { body: { required: true, content: { 'multipart/form-data': { schema: CoverUpload } } } },
  responses: { 200: { description: 'Portada', ...json(CoverResult) }, ...errorResponses(400, 401, 413) },
});
const deleteCover = createRoute({
  method: 'delete', path: '/api/v1/me/cover', tags, security: bearer, middleware: [requireUser] as const,
  summary: 'Quitar mi portada', responses: { 200: { description: 'Sin portada', ...json(CoverResult) }, ...errorResponses(401) },
});

// ---------- rutas: admin ----------

const adminItems = createRoute({
  method: 'get', path: '/api/v1/admin/shop/items', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Catálogo (admin)', description: 'Todo el catálogo, también lo inactivo, con cuántas cuentas tienen cada artículo.',
  request: { query: AdminShopItemQuery },
  responses: { 200: { description: 'Catálogo', ...json(AdminShopItemList) }, ...errorResponses(400, 401, 403) },
});
const adminItemPatch = createRoute({
  method: 'patch', path: '/api/v1/admin/shop/items/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar un artículo',
  description:
    'Precio en puntos (lo de todos), precio en monedas VIP (lo VIP), activo, orden, nombre, descripción y si es solo VIP. `null` ' +
    'en un precio lo saca de la venta. Al pasar a VIP o a todos se borra el precio de la otra moneda. El tipo no se cambia, y ' +
    'el artículo que viene con el VIP sigue siendo VIP.',
  request: { params: ItemParam, body: { required: true, ...json(AdminShopItemPatch) } },
  responses: { 200: { description: 'Artículo', ...json(AdminShopItem) }, ...errorResponses(400, 401, 403, 404) },
});
const adminConfig = createRoute({
  method: 'get', path: '/api/v1/admin/points/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Configuración de los puntos', responses: { 200: { description: 'Configuración', ...json(PointsConfig) }, ...errorResponses(401, 403) },
});
const adminConfigPut = createRoute({
  method: 'put', path: '/api/v1/admin/points/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar la configuración de los puntos',
  description: 'Cambia el saldo de todos: los puntos y las monedas se calculan con estos valores, también los de mixes viejos.',
  request: { body: { required: true, ...json(PointsConfigPatch) } },
  responses: { 200: { description: 'Configuración', ...json(PointsConfig) }, ...errorResponses(400, 401, 403) },
});
const adminAccounts = createRoute({
  method: 'get', path: '/api/v1/admin/points/accounts', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Puntos de las cuentas', description: 'Saldo, monedas VIP, artículos y portada de cada cuenta.',
  request: { query: AdminAccountQuery },
  responses: { 200: { description: 'Cuentas', ...json(AdminAccountList) }, ...errorResponses(400, 401, 403) },
});
const adminUserPoints = createRoute({
  method: 'get', path: '/api/v1/admin/users/{id}/points', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Puntos de una cuenta', request: { params: IdParam },
  responses: { 200: { description: 'Saldo', ...json(Points) }, ...errorResponses(401, 403, 404) },
});
const adminUserHistory = createRoute({
  method: 'get', path: '/api/v1/admin/users/{id}/points/history', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Movimientos de una cuenta', request: { params: IdParam, query: PointsHistoryQuery },
  responses: { 200: { description: 'Movimientos', ...json(PointsHistory) }, ...errorResponses(400, 401, 403, 404) },
});
const adminGrant = createRoute({
  method: 'post', path: '/api/v1/admin/users/{id}/points', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Sumar o restar puntos o monedas VIP', description: 'Con motivo. Avisa a la cuenta.',
  request: { params: IdParam, body: { required: true, ...json(PointsGrant) } },
  responses: { 200: { description: 'Saldo', ...json(Points) }, ...errorResponses(400, 401, 403, 404) },
});
const adminUserItems = createRoute({
  method: 'get', path: '/api/v1/admin/users/{id}/items', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Inventario de una cuenta', description: 'Lo comprado y lo regalado (el premio VIP no está: viene con el VIP).',
  request: { params: IdParam, query: UserItemQuery },
  responses: { 200: { description: 'Inventario', ...json(UserItemList) }, ...errorResponses(400, 401, 403, 404) },
});
const adminItemGrant = createRoute({
  method: 'post', path: '/api/v1/admin/users/{id}/items', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Regalar un artículo', description: 'También uno sin precio o uno VIP (se usa mientras la cuenta sea VIP). Avisa a la cuenta.',
  request: { params: IdParam, body: { required: true, ...json(ItemGrant) } },
  responses: { 200: { description: 'Artículo regalado', ...json(UserItem) }, ...errorResponses(400, 401, 403, 404) },
});
const adminItemRevoke = createRoute({
  method: 'post', path: '/api/v1/admin/users/{id}/items/{item}/revoke', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Quitar un artículo', description: 'Del inventario y de lo equipado, con motivo. No devuelve lo pagado. Avisa a la cuenta.',
  request: { params: UserItemParam, body: { required: true, ...json(Reason) } },
  responses: { 204: { description: 'Quitado' }, ...errorResponses(400, 401, 403, 404) },
});
const adminCoverClear = createRoute({
  method: 'post', path: '/api/v1/admin/users/{id}/cover/clear', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Quitar la portada de una cuenta', description: 'Moderación, con motivo. Avisa a la cuenta.',
  request: { params: IdParam, body: { required: true, ...json(Reason) } },
  responses: { 200: { description: 'Sin portada', ...json(CoverResult) }, ...errorResponses(400, 401, 403, 404) },
});

// ---------- lectura ----------

type CatalogRow = {
  id: string | null; kind: string | null; name: string | null; description: string | null; file: string | null; css_class: string | null;
  vip_only: boolean | null; vip_reward: boolean | null; animated: boolean | null; collection: string | null; base_price: number | null;
  price: number | null; vip_price: number | null; weekly: boolean | null; sort: number | null; is_new: boolean | null;
};
const CATALOG = 'id, kind, name, description, file, css_class, vip_only, vip_reward, animated, collection, base_price, price, vip_price, weekly, sort, is_new';

type ConfigRow = z.infer<typeof PointsConfig>;
const CONFIG =
  'per_mix, per_win, vip_multiplier, vip_per_mix, vip_per_win, weekly_count, weekly_discount, custom_avatar_price, custom_bg_animated_price, custom_bg_static_price, custom_max_avatar, custom_max_background, code_vip_free';
export const readConfig = async (c: C): Promise<ConfigRow> =>
  mustHave(await c.var.sb.from('points_config').select(CONFIG).eq('id', 1).single()) as ConfigRow;

const EMPTY_EQUIPPED = { frame: null, avatar: null, background: null, theme: null, name: null, stickers: [] as string[] };
async function readEquipped(c: C, uid: string) {
  const r = must(
    await c.var.sb
      .from('user_cosmetics')
      .select('frame, avatar, background, theme, name, stickers, avatar_custom, background_custom')
      .eq('user_id', uid)
      .maybeSingle(),
  );
  if (!r) return EMPTY_EQUIPPED;
  // Lo propio puesto se ve como `custom:<id>` de la subida (bitácoras 2026-11-13-avatar-y-fondo-propios y
  // 2026-11-14-inventario-de-lo-propio).
  const { avatar_custom, background_custom, ...eq } = r;
  return {
    ...eq,
    avatar: avatar_custom ? `custom:${avatar_custom}` : eq.avatar,
    background: background_custom ? `custom:${background_custom}` : eq.background,
    stickers: eq.stickers ?? [],
  };
}

/** Lo que tiene la cuenta, si es VIP hoy y qué tiene puesto. */
async function mine(c: C, uid: string) {
  const [owned, vip, eq, cfg] = await Promise.all([
    c.var.sb.from('user_items').select('item_id, expires_at, source').eq('user_id', uid).then(mustHave),
    vipStatusOf(c.var.sb, [uid]).then((m) => !!m.get(uid)?.active),
    readEquipped(c, uid),
    readConfig(c),
  ]);
  // Lo de un código vencido ya no es suyo (se puede comprar), pero se dice hasta cuándo lo tuvo (replanteo 126).
  const now = Date.now();
  return {
    owned: new Set(owned.filter((r) => !r.expires_at || Date.parse(r.expires_at) > now).map((r) => r.item_id)),
    expires: new Map(owned.filter((r) => r.expires_at).map((r) => [r.item_id, r.expires_at as string])),
    // Lo VIP de un código se usa sin ser VIP mientras code_vip_free esté encendido (replanteo 126), como en can_use_item.
    vipFree: new Set(cfg.code_vip_free ? owned.filter((r) => r.source === 'code').map((r) => r.item_id) : []),
    vip,
    equipped: new Set([eq.frame, eq.avatar, eq.background, eq.theme, eq.name, ...eq.stickers].filter((x): x is string => !!x)),
  };
}

export const readPoints = async (c: C, uid?: string) =>
  mustHave(await c.var.sb.rpc('points_summary', uid ? { p_user: uid } : {})) as unknown as z.infer<typeof Points>;

async function readHistory(c: C, q: z.infer<typeof PointsHistoryQuery>, uid?: string) {
  const rows = mustHave(
    await c.var.sb.rpc('points_history', {
      ...(uid ? { p_user: uid } : {}), p_currency: q.currency, p_limit: q.per, p_offset: (q.page - 1) * q.per,
    }),
  );
  // Una página vacía no trae el total: si se pasó del final, se cuenta con la primera.
  let total = rows[0]?.total ?? 0;
  if (!rows.length && q.page > 1) {
    const first = mustHave(await c.var.sb.rpc('points_history', { ...(uid ? { p_user: uid } : {}), p_currency: q.currency, p_limit: 1, p_offset: 0 }));
    total = first[0]?.total ?? 0;
  }
  const items = rows.map((r) => ({ kind: r.kind as 'mix' | 'mm' | 'grant' | 'purchase' | 'custom', at: r.at, amount: r.amount, label: r.label, ref: r.ref }));
  return envelope(items, Number(total), { page: q.page, per: q.per, sort: 'at', order: 'desc' });
}

type AdminItemRow = {
  id: string; kind: string; name: string; description: string | null; file: string | null; css_class: string | null; collection: string;
  animated: boolean; vip_only: boolean; vip_reward: boolean; price: number | null; vip_price: number | null; active: boolean; sort: number;
  user_items: { count: number }[] | null;
};
const ADMIN_ITEM = 'id, kind, name, description, file, css_class, collection, animated, vip_only, vip_reward, price, vip_price, active, sort, user_items(count)';
const toAdminItem = ({ user_items, ...r }: AdminItemRow) => ({ ...r, kind: r.kind as z.infer<typeof AdminShopItem>['kind'], owners: user_items?.[0]?.count ?? 0 });

type UserItemRow = {
  item_id: string; source: string; currency: string; price_paid: number | null; note: string | null; acquired_at: string;
  expires_at: string | null;
  shop_items: { id: string; kind: string; name: string; file: string | null; css_class: string | null; animated: boolean; vip_only: boolean } | null;
};
const toUserItem = (r: UserItemRow) => ({
  item: cosmeticOf(r.shop_items ?? { id: r.item_id, kind: 'frame', name: r.item_id, file: null, css_class: null, animated: false, vip_only: false }),
  source: r.source as 'purchase' | 'grant' | 'code',
  currency: r.source === 'purchase' ? (r.currency as 'points' | 'vip') : null,
  price_paid: r.price_paid,
  note: r.note,
  acquired_at: r.acquired_at,
  expires_at: r.expires_at,
});
const userItemsQuery = (c: C, uid: string, kind?: string) => {
  const embed = kind ? 'shop_items!inner(id, kind, name, file, css_class, animated, vip_only)' : 'shop_items(id, kind, name, file, css_class, animated, vip_only)';
  let q = c.var.sb.from('user_items').select(`item_id, source, currency, price_paid, note, acquired_at, expires_at, ${embed}`, { count: 'exact' }).eq('user_id', uid);
  if (kind) q = q.eq('shop_items.kind', kind);
  return q;
};

async function existing(c: C, id: string) {
  if (!(await userExists(c.var.sb, id))) throw notFound('ese usuario');
  return id;
}

/** Borra del bucket avatars un archivo que ya no se usa, sin demorar la respuesta. */
function dropAvatarFile(c: C, url: string | null | undefined, sb = c.var.sb) {
  if (!url?.includes(AVATAR_MARKER)) return;
  const path = decodeURIComponent(url.split(AVATAR_MARKER)[1]!.split('?')[0]!);
  inBackground(
    c,
    sb.storage.from(AVATARS).remove([path]).then((r) => {
      if (r.error) throw new Error(`borrar portada ${path}: ${r.error.message}`);
    }),
  );
}

// ---------- router ----------

export const shop = createRouter()
  .openapi(items, async (c) => {
    const p = c.req.valid('query');
    const u = currentUser(c);
    if (p.owned !== undefined && !u) throw new AppError(401, 'UNAUTHORIZED', 'Inicia sesión para ver lo que tienes.');
    const me = u ? await mine(c, u.id) : null;

    let q = c.var.sb.from('shop_catalog').select(CATALOG, { count: 'exact' });
    if (p.kind) q = q.eq('kind', p.kind);
    if (p.collection) q = q.eq('collection', p.collection);
    if (p.vip !== undefined) q = q.eq('vip_only', p.vip);
    if (p.weekly !== undefined) q = q.eq('weekly', p.weekly);
    if (p.is_new !== undefined) q = q.eq('is_new', p.is_new);
    const term = nameTerm(p.q);
    if (term) q = q.ilike('name', `%${term}%`);
    if (me && p.owned !== undefined) {
      // Lo que tiene: lo comprado o regalado, y el premio VIP si es VIP.
      const ids = [...me.owned];
      if (p.owned) {
        q = me.vip ? q.or(`vip_reward.eq.true${ids.length ? `,id.in.(${ids.join(',')})` : ''}`) : q.in('id', ids.length ? ids : ['-']);
      } else {
        if (ids.length) q = q.not('id', 'in', `(${ids.join(',')})`);
        if (me.vip) q = q.eq('vip_reward', false);
      }
    }
    const { rows, total } = await runList<CatalogRow, typeof q>(q, p, { price: ['price', 'vip_price'], sort: 'sort', name: 'name' });
    const out = rows.map((r) => {
      const owned = r.vip_reward ? !!me?.vip : !!me?.owned.has(r.id!);
      return {
        id: r.id!, kind: r.kind as z.infer<typeof AdminShopItem>['kind'], name: r.name ?? '', description: r.description, file: r.file,
        css_class: r.css_class, collection: r.collection ?? '', animated: !!r.animated, vip_only: !!r.vip_only, vip_reward: !!r.vip_reward,
        price: r.price, base_price: r.base_price, vip_price: r.vip_price, weekly: !!r.weekly, is_new: !!r.is_new,
        owned,
        usable: owned && (!r.vip_only || !!me?.vip || !!me?.vipFree.has(r.id!)),
        equipped: !!me?.equipped.has(r.id!),
        expires_at: me?.expires.get(r.id!) ?? null,
      };
    });
    return c.json({ ...envelope(out, total, p), weekly_ends: weeklyEnds() }, 200);
  })
  .openapi(config, async (c) => c.json(await readConfig(c), 200))
  .openapi(playerCosmetics, async (c) => {
    const rows = await cosmeticsRows(c.var.sb, c.req.valid('query').players);
    return c.json({ items: [...rows.values()].map((r) => ({ player_id: r.player_id!, vip: !!r.vip, ...toFull(r) })) }, 200);
  })
  .openapi(buy, async (c) => {
    const r = mustHave(await c.var.sb.rpc('shop_buy', { p_item: c.req.valid('param').id })) as unknown as z.infer<typeof BuyResult>;
    return c.json(r, 200);
  })
  .openapi(myPoints, async (c) => c.json(await readPoints(c), 200))
  .openapi(myHistory, async (c) => c.json(await readHistory(c, c.req.valid('query')), 200))
  .openapi(myCosmetics, async (c) => c.json(await readEquipped(c, c.var.user.id), 200))
  .openapi(equip, async (c) => {
    const r = mustHave(await c.var.sb.rpc('set_my_cosmetics', { p_data: c.req.valid('json') })) as unknown as z.infer<typeof Equipped>;
    return c.json(r, 200);
  })
  .openapi(uploadCover, async (c) => {
    const { sb, user: u } = c.var;
    const { bytes, type } = await readImage(c.req.valid('form').file, AVATAR_MAX_BYTES);
    checkShape(bytes, type, COVER_SHAPE);
    const previous = must(await sb.from('profile_details').select('cover_url').eq('user_id', u.id).maybeSingle())?.cover_url;
    const bucket = sb.storage.from(AVATARS);
    // La política de Storage solo deja escribir en la carpeta <uid>/ del propio usuario (la misma del avatar).
    const path = `${u.id}/cover-${Date.now()}.${type.ext}`;
    const up = await bucket.upload(path, bytes, { contentType: type.mime, upsert: false });
    if (up.error) throw storageError(up.error);
    const cover_url = bucket.getPublicUrl(path).data.publicUrl;
    const saved = await sb.from('profile_details').upsert({ user_id: u.id, cover_url, updated_at: new Date().toISOString() });
    if (saved.error) {
      await bucket.remove([path]);
      must(saved);
    }
    dropAvatarFile(c, previous);
    return c.json({ cover_url }, 200);
  })
  .openapi(deleteCover, async (c) => {
    const { sb, user: u } = c.var;
    const previous = must(await sb.from('profile_details').select('cover_url').eq('user_id', u.id).maybeSingle())?.cover_url;
    if (previous) {
      must(await sb.from('profile_details').update({ cover_url: null, updated_at: new Date().toISOString() }).eq('user_id', u.id));
      dropAvatarFile(c, previous);
    }
    return c.json({ cover_url: null }, 200);
  })
  // ---------- admin ----------
  .openapi(adminItems, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('shop_items').select(ADMIN_ITEM, { count: 'exact' });
    if (p.kind) q = q.eq('kind', p.kind);
    if (p.collection) q = q.eq('collection', p.collection);
    if (p.vip !== undefined) q = q.eq('vip_only', p.vip);
    if (p.active !== undefined) q = q.eq('active', p.active);
    const term = nameTerm(p.q);
    if (term) q = q.or(`name.ilike.%${term}%,id.ilike.%${term}%`);
    const { rows, total } = await runList<AdminItemRow, typeof q>(q, p, { kind: ['kind', 'sort:asc'] });
    return c.json(envelope(rows.map(toAdminItem), total, p), 200);
  })
  .openapi(adminItemPatch, async (c) => {
    const id = c.req.valid('param').id;
    must(await c.var.sb.rpc('admin_shop_item_update', { p_item: id, p_changes: c.req.valid('json') }));
    const row = must(await c.var.sb.from('shop_items').select(ADMIN_ITEM).eq('id', id).maybeSingle()) as AdminItemRow | null;
    if (!row) throw notFound('ese artículo');
    return c.json(toAdminItem(row), 200);
  })
  .openapi(adminConfig, async (c) => c.json(await readConfig(c), 200))
  .openapi(adminConfigPut, async (c) => {
    must(await c.var.sb.rpc('set_points_config', { p_changes: c.req.valid('json') }));
    return c.json(await readConfig(c), 200);
  })
  .openapi(adminAccounts, async (c) => {
    const p = c.req.valid('query');
    const rows = mustHave(
      await c.var.sb.rpc('admin_points_accounts', {
        ...(p.q?.trim() ? { p_q: p.q.trim() } : {}), ...(p.vip !== undefined ? { p_vip: p.vip } : {}),
        p_sort: `${p.sort}:${p.order}`, p_limit: p.per, p_offset: (p.page - 1) * p.per,
      }),
    );
    let total = Number(rows[0]?.total ?? 0);
    if (!rows.length && p.page > 1) {
      const first = mustHave(await c.var.sb.rpc('admin_points_accounts', {
        ...(p.q?.trim() ? { p_q: p.q.trim() } : {}), ...(p.vip !== undefined ? { p_vip: p.vip } : {}), p_limit: 1, p_offset: 0,
      }));
      total = Number(first[0]?.total ?? 0);
    }
    const items = rows.map((r) => ({
      user: { id: r.user_id, alias: r.alias ?? '' },
      player: r.player_id ? { id: r.player_id, alias: r.nick ?? '' } : null,
      vip: !!r.vip,
      points: { earned: r.earned, granted: r.granted, spent: r.spent, balance: r.balance, mixes: r.mixes },
      vip_coins: { earned: r.vip_earned, granted: r.vip_granted, spent: r.vip_spent, balance: r.vip_balance },
      items: r.items,
      cover_url: r.cover_url,
    }));
    return c.json(envelope(items, total, p), 200);
  })
  .openapi(adminUserPoints, async (c) => c.json(await readPoints(c, await existing(c, c.req.valid('param').id)), 200))
  .openapi(adminUserHistory, async (c) =>
    c.json(await readHistory(c, c.req.valid('query'), await existing(c, c.req.valid('param').id)), 200),
  )
  .openapi(adminGrant, async (c) => {
    const id = await existing(c, c.req.valid('param').id);
    const b = c.req.valid('json');
    must(await c.var.sb.rpc('admin_points_grant', { p_user: id, p_amount: b.amount, p_reason: b.reason, p_currency: b.currency }));
    return c.json(await readPoints(c, id), 200);
  })
  .openapi(adminUserItems, async (c) => {
    const id = await existing(c, c.req.valid('param').id);
    const p = c.req.valid('query');
    let q = userItemsQuery(c, id, p.kind);
    if (p.source) q = q.eq('source', p.source);
    const { rows, total } = await runList<UserItemRow, typeof q>(q, p, {}, 'item_id');
    return c.json(envelope(rows.map(toUserItem), total, p), 200);
  })
  .openapi(adminItemGrant, async (c) => {
    const id = await existing(c, c.req.valid('param').id);
    const b = c.req.valid('json');
    must(await c.var.sb.rpc('admin_item_grant', { p_user: id, p_item: b.item, ...(b.note ? { p_note: b.note } : {}) }));
    const row = mustHave(await userItemsQuery(c, id).eq('item_id', b.item).single()) as unknown as UserItemRow;
    return c.json(toUserItem(row), 200);
  })
  .openapi(adminItemRevoke, async (c) => {
    const { id, item } = c.req.valid('param');
    await existing(c, id);
    must(await c.var.sb.rpc('admin_item_revoke', { p_user: id, p_item: item, p_reason: c.req.valid('json').reason }));
    return c.body(null, 204);
  })
  .openapi(adminCoverClear, async (c) => {
    const id = await existing(c, c.req.valid('param').id);
    const url = must(await c.var.sb.rpc('admin_cover_clear', { p_user: id, p_reason: c.req.valid('json').reason }));
    // El archivo es de la carpeta del usuario: solo la clave de servicio lo puede borrar. Sin ella, queda en el bucket.
    const service = serviceClient(c.var.config);
    if (service) dropAvatarFile(c, url as string | null, service);
    return c.json({ cover_url: null }, 200);
  });
