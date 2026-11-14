import { z } from '@hono/zod-openapi';
import { boolParam, Envelope, listQuery } from '../lib/list';

// Tienda de cosméticos con puntos y monedas VIP (replanteo 113, bitácora docs/bitacora/2026-11-11-tienda-de-puntos).
// Los archivos de cada artículo están en el frontend, en /cosmetics/<file> (web/frontend/public/cosmetics/).

export const KINDS = ['frame', 'avatar', 'background', 'theme', 'name', 'sticker'] as const;
const Kind = z.enum(KINDS).openapi({
  description: '`frame` (marco), `avatar` (reemplaza la foto), `background` (fondo de miniperfil), `theme` (tema), `name` (efecto de nombre) o `sticker`',
});
const Currency = z.enum(['points', 'vip']).openapi({ description: '`points` (puntos) o `vip` (monedas VIP)' });
const ItemId = z.string().regex(/^[a-z0-9-]{2,60}$/, 'Artículo inválido');
/** Avatar o fondo de miniperfil: un artículo o una subida propia guardada (`custom:<id>`). */
const ItemOrCustom = z
  .string()
  .regex(/^([a-z0-9-]{2,60}|custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/, 'Artículo inválido');

/** Un cosmético como lo necesita la web para dibujarlo. */
export const Cosmetic = z
  .object({
    id: z.string(),
    kind: Kind,
    name: z.string(),
    file: z.string().nullable().openapi({
      description: 'Archivo en /cosmetics/ (marcos, fondos, stickers y avatares); null si es una clase CSS. Un avatar es un .webm con un .webp fijo del mismo nombre',
    }),
    css_class: z.string().nullable().openapi({ description: 'Clase de cosmeticos.css (temas y efectos de nombre); null si es un archivo' }),
    animated: z.boolean(),
    vip_only: z.boolean(),
    url: z.string().nullable().optional().openapi({
      description: 'Solo lo propio (id `custom`): la dirección del archivo subido (WebM si es animado, la imagen si es fijo). `file` es null',
    }),
    poster_url: z.string().nullable().optional().openapi({ description: 'Solo lo propio animado: la imagen fija (WebP)' }),
  })
  .openapi('Cosmetic');

/** Lo que se ve en los listados: el marco, el avatar y el efecto de nombre (la web de hoy no muestra el marco en las filas). */
export const CosmeticsLight = z
  .object({ frame: Cosmetic.nullable(), avatar: Cosmetic.nullable(), name: Cosmetic.nullable() })
  .openapi('CosmeticsLight', { description: 'Lo equipado que se ve en los listados. Sin lo que la cuenta ya no puede usar (VIP vencido)' });

/** Todo lo equipado: la ficha del jugador. */
export const CosmeticsFull = CosmeticsLight.extend({
  background: Cosmetic.nullable(),
  theme: Cosmetic.nullable(),
  stickers: z.array(Cosmetic).max(3),
}).openapi('CosmeticsFull', { description: 'Todo lo equipado, sin lo que la cuenta ya no puede usar (VIP vencido o quitado por un admin)' });

export const PlayerCosmetics = CosmeticsFull.extend({ player_id: z.uuid(), vip: z.boolean() }).openapi('PlayerCosmetics');
export const PlayerCosmeticsQuery = z.object({
  players: z
    .string()
    .transform((s) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))])
    .pipe(z.array(z.uuid('Id de ficha inválido')).min(1, 'Falta al menos una ficha').max(100, 'Hasta 100 fichas'))
    .openapi({ type: 'string', description: 'Ids de fichas separados por coma (hasta 100)' }),
});
export const PlayerCosmeticsList = z.object({ items: z.array(PlayerCosmetics) }).openapi('PlayerCosmeticsList');

// ---------- catálogo ----------

export const ShopItem = z
  .object({
    id: z.string(),
    kind: Kind,
    name: z.string(),
    description: z.string().nullable(),
    file: z.string().nullable(),
    css_class: z.string().nullable(),
    collection: z.string().openapi({ description: 'Colección (`cs`, `paises`, `mapas`…), para agrupar en la tienda' }),
    animated: z.boolean(),
    vip_only: z.boolean().openapi({ description: 'Artículo VIP: se compra con monedas VIP siendo VIP y se usa mientras la cuenta sea VIP' }),
    vip_reward: z.boolean().openapi({ description: 'Viene con el VIP, sin comprarlo (el Marco Oro VIP)' }),
    price: z.number().int().nullable().openapi({ description: 'Precio de hoy en puntos (con la oferta de la semana); null si no se vende con puntos' }),
    base_price: z.number().int().nullable().openapi({ description: 'Precio sin la oferta' }),
    vip_price: z.number().int().nullable().openapi({ description: 'Precio en monedas VIP (solo lo VIP); null si no se vende' }),
    weekly: z.boolean().openapi({ description: 'Está en las ofertas de esta semana' }),
    owned: z.boolean().openapi({ description: 'Lo tienes (con sesión; sin sesión, false)' }),
    usable: z.boolean().openapi({ description: 'Puedes equiparlo hoy: lo tienes (lo VIP, siendo VIP) o es el premio VIP y eres VIP' }),
    equipped: z.boolean().openapi({ description: 'Lo tienes puesto' }),
  })
  .openapi('ShopItem');

export const ShopItemQuery = listQuery(['sort', 'price', 'name'], { sort: 'sort', order: 'asc' }, 400).extend({
  kind: Kind.optional(),
  collection: z.string().regex(/^[a-z0-9]{2,20}$/).optional(),
  vip: boolParam('Solo lo VIP (`true`) o solo lo de todos (`false`)'),
  weekly: boolParam('Solo las ofertas de la semana'),
  owned: boolParam('Solo lo que tienes (`true`) o lo que no (`false`). Necesita sesión'),
  q: z.string().max(40).optional().openapi({ description: 'Busca en el nombre' }),
});
export const ShopItemList = Envelope(ShopItem).extend({
  weekly_ends: z.string().openapi({ description: 'Cuándo cambian las ofertas (lunes 00:00 de Argentina)' }),
}).openapi('ShopItemList');

export const PointsConfig = z
  .object({
    per_mix: z.number().int().openapi({ description: 'Puntos por mix o mapa del matchmaking terminado' }),
    per_win: z.number().int().openapi({ description: 'Puntos extra si ganó su equipo' }),
    vip_multiplier: z.number().openapi({ description: 'Multiplicador de los puntos en los mixes jugados siendo VIP (1: sin multiplicar)' }),
    vip_per_mix: z.number().int().openapi({ description: 'Monedas VIP por mix jugado siendo VIP' }),
    vip_per_win: z.number().int().openapi({ description: 'Monedas VIP extra si ganó' }),
    weekly_count: z.number().int().openapi({ description: 'Artículos en oferta cada semana' }),
    weekly_discount: z.number().int().openapi({ description: 'Descuento de las ofertas, en %' }),
    custom_avatar_price: z.number().int().openapi({ description: 'Subir un avatar animado propio (VIP), en monedas VIP' }),
    custom_bg_animated_price: z.number().int().openapi({ description: 'Subir un fondo animado propio (VIP), en monedas VIP' }),
    custom_bg_static_price: z.number().int().openapi({ description: 'Subir un fondo de miniperfil fijo propio, en puntos' }),
    custom_max_avatar: z.number().int().openapi({ description: 'Cuántos avatares propios guarda cada cuenta' }),
    custom_max_background: z.number().int().openapi({ description: 'Cuántos fondos de miniperfil propios (fijos y animados) guarda cada cuenta' }),
  })
  .openapi('PointsConfig');

export const PointsConfigPatch = z
  .object({
    per_mix: z.number().int().min(0).max(1000).optional(),
    per_win: z.number().int().min(0).max(1000).optional(),
    vip_multiplier: z.number().min(1).max(3).optional(),
    vip_per_mix: z.number().int().min(0).max(1000).optional(),
    vip_per_win: z.number().int().min(0).max(1000).optional(),
    weekly_count: z.number().int().min(0).max(24).optional(),
    weekly_discount: z.number().int().min(0).max(90).optional(),
    custom_avatar_price: z.number().int().min(1).max(1_000_000).optional(),
    custom_bg_animated_price: z.number().int().min(1).max(1_000_000).optional(),
    custom_bg_static_price: z.number().int().min(1).max(1_000_000).optional(),
    custom_max_avatar: z.number().int().min(1).max(50).optional(),
    custom_max_background: z.number().int().min(1).max(50).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Manda al menos un valor')
  .openapi('PointsConfigPatch');

// ---------- puntos de una cuenta ----------

const Balance = z.object({
  earned: z.number().int().openapi({ description: 'Ganados en mixes' }),
  granted: z.number().int().openapi({ description: 'Regalos y correcciones de un admin (pueden ser negativos)' }),
  spent: z.number().int().openapi({ description: 'Gastados en la tienda' }),
  balance: z.number().int().openapi({ description: 'Saldo: ganados + regalos − gastados. Puede ser negativo si se borró un mix después de una compra' }),
  mixes: z.number().int().openapi({ description: 'Mixes que sumaron' }),
});
export const Points = z
  .object({
    vip: z.boolean().openapi({ description: 'Es VIP hoy' }),
    has_player: z.boolean().openapi({ description: 'Tiene ficha de jugador vinculada (sin ficha no suma ni compra)' }),
    points: Balance,
    vip_coins: Balance.extend({ frozen: z.boolean().openapi({ description: 'Congeladas: hoy no es VIP' }) }),
  })
  .openapi('Points');

export const PointsHistoryQuery = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ description: 'Página, desde 1' }),
  per: z.coerce.number().int().min(1).max(100).default(20).openapi({ description: 'Elementos por página (máximo 100)' }),
  currency: Currency.default('points'),
});
export const PointsMove = z
  .object({
    kind: z.enum(['mix', 'mm', 'grant', 'purchase', 'custom']).openapi({
      description: '`mix`, `mm` (mapa del matchmaking), `grant` (admin), `purchase` o `custom` (subió su avatar o su fondo)',
    }),
    at: z.string().nullable(),
    amount: z.number().int().openapi({ description: 'Positivo suma, negativo resta' }),
    label: z.string().openapi({ description: 'Mapa y si ganó, el motivo del admin o el artículo comprado' }),
    ref: z.string().nullable().openapi({ description: 'La partida (mix y mm), el artículo (purchase) o la subida (custom)' }),
  })
  .openapi('PointsMove');
export const PointsHistory = Envelope(PointsMove).openapi('PointsHistory', { description: 'Lo más nuevo primero (sort `at`, order `desc`)' });

// ---------- comprar y equipar ----------

export const BuyResult = z
  .object({
    item: z.string(),
    price_paid: z.number().int(),
    currency: Currency,
    balance: z.number().int().openapi({ description: 'Saldo nuevo de esa moneda' }),
  })
  .openapi('BuyResult');

export const Equipped = z
  .object({
    frame: z.string().nullable(),
    avatar: z.string().nullable(),
    background: z.string().nullable(),
    theme: z.string().nullable(),
    name: z.string().nullable(),
    stickers: z.array(z.string()).max(3),
  })
  .openapi('Equipped', {
    description: 'Ids de lo equipado (tal como lo guardó; la ficha pública oculta lo que ya no puede usar). `custom:<id>` en avatar o background: una subida propia',
  });

export const EquipPatch = z
  .object({
    frame: ItemId.nullable().optional(),
    avatar: ItemOrCustom.nullable().optional(),
    background: ItemOrCustom.nullable().optional(),
    theme: ItemId.nullable().optional(),
    name: ItemId.nullable().optional(),
    stickers: z.array(ItemId).max(3, 'Hasta 3 stickers').optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Manda al menos un cambio')
  .openapi('EquipPatch', {
    description: 'Lo que no viene no se toca; `null` lo saca. `custom:<id>` en avatar o background pone una subida propia guardada, sin pagar',
  });

export const COVER_HELP = 'JPEG, PNG o WebP de hasta 1 MB, de proporción 4:1, entre 800×200 y 2400×600 (el frontend lo recorta antes de subirlo).';
export const CoverUpload = z
  .object({ file: z.instanceof(File).openapi({ type: 'string', format: 'binary', description: COVER_HELP }) })
  .openapi('CoverUpload');
export const CoverResult = z.object({ cover_url: z.string().nullable() }).openapi('CoverResult');

// ---------- admin ----------

export const AdminShopItem = z
  .object({
    id: z.string(),
    kind: Kind,
    name: z.string(),
    description: z.string().nullable(),
    file: z.string().nullable(),
    css_class: z.string().nullable(),
    collection: z.string(),
    animated: z.boolean(),
    vip_only: z.boolean(),
    vip_reward: z.boolean(),
    price: z.number().int().nullable().openapi({ description: 'Precio de lista en puntos; null no se vende' }),
    vip_price: z.number().int().nullable(),
    active: z.boolean().openapi({ description: 'Se ve en la tienda. Quien ya lo tiene lo sigue usando' }),
    sort: z.number().int(),
    owners: z.number().int().openapi({ description: 'Cuántas cuentas lo tienen' }),
  })
  .openapi('AdminShopItem');
export const AdminShopItemQuery = listQuery(['sort', 'name', 'price', 'vip_price', 'kind'], { sort: 'sort', order: 'asc' }, 400).extend({
  kind: Kind.optional(),
  collection: z.string().regex(/^[a-z0-9]{2,20}$/).optional(),
  vip: boolParam('Solo lo VIP o solo lo de todos'),
  active: boolParam('Activos o inactivos'),
  q: z.string().max(40).optional().openapi({ description: 'Busca en el nombre o el id' }),
});
export const AdminShopItemList = Envelope(AdminShopItem).openapi('AdminShopItemList');
export const ItemParam = z.object({ id: ItemId.openapi({ param: { name: 'id', in: 'path' } }) });

export const AdminShopItemPatch = z
  .object({
    price: z.number().int().min(1).max(1_000_000).nullable().optional().openapi({ description: 'Puntos; `null` lo saca de la venta' }),
    vip_price: z.number().int().min(1).max(1_000_000).nullable().optional().openapi({ description: 'Monedas VIP (solo lo VIP); `null` lo saca de la venta' }),
    active: z.boolean().optional(),
    sort: z.number().int().optional(),
    name: z.string().trim().min(1).max(60).optional(),
    description: z.string().trim().max(200).nullable().optional(),
    vip_only: z.boolean().optional().openapi({
      description: 'Solo VIP o para todos. Borra el precio de la otra moneda: manda el nuevo (`vip_price` o `price`) en el mismo cambio',
    }),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Manda al menos un cambio')
  .openapi('AdminShopItemPatch');

export const AdminAccountPoints = z
  .object({
    user: z.object({ id: z.uuid(), alias: z.string() }),
    player: z.object({ id: z.uuid(), alias: z.string() }).nullable(),
    vip: z.boolean(),
    points: Balance,
    vip_coins: Balance.omit({ mixes: true }),
    items: z.number().int(),
    cover_url: z.string().nullable(),
  })
  .openapi('AdminAccountPoints');
export const AdminAccountQuery = listQuery(['balance', 'vip_balance', 'mixes', 'alias'], { sort: 'balance', order: 'desc' }).extend({
  q: z.string().max(40).optional().openapi({ description: 'Busca en el alias o el nick' }),
  vip: boolParam('Solo VIP o solo no VIP'),
});
export const AdminAccountList = Envelope(AdminAccountPoints).openapi('AdminAccountList');

export const UserItem = z
  .object({
    item: Cosmetic,
    source: z.enum(['purchase', 'grant']),
    currency: Currency.nullable().openapi({ description: 'Con qué se pagó; null si fue un regalo' }),
    price_paid: z.number().int().nullable(),
    note: z.string().nullable(),
    acquired_at: z.string(),
  })
  .openapi('UserItem');
export const UserItemQuery = listQuery(['acquired_at'], { sort: 'acquired_at', order: 'desc' }).extend({
  kind: Kind.optional(),
  source: z.enum(['purchase', 'grant']).optional(),
});
export const UserItemList = Envelope(UserItem).openapi('UserItemList');

export const PointsGrant = z
  .object({
    currency: Currency.default('points'),
    amount: z.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0, 'La cantidad no puede ser 0'),
    reason: z.string().trim().min(1, 'El motivo es obligatorio').max(200, 'Hasta 200 caracteres'),
  })
  .openapi('PointsGrant');
export const ItemGrant = z
  .object({ item: ItemId, note: z.string().trim().max(200, 'Hasta 200 caracteres').optional() })
  .openapi('ItemGrant');
export const Reason = z.object({ reason: z.string().trim().min(1, 'El motivo es obligatorio').max(200, 'Hasta 200 caracteres') }).openapi('Reason');
export const UserItemParam = z.object({
  id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }),
  item: ItemId.openapi({ param: { name: 'item', in: 'path' } }),
});

// ---------- lo propio (bitácora 2026-11-13-avatar-y-fondo-propios) ----------

export const CUSTOM_KINDS = ['avatar', 'background'] as const;
export const CustomKind = z
  .enum(CUSTOM_KINDS)
  .openapi({ description: '`avatar` (animado, VIP) o `background` (fondo de miniperfil: fijo o, siendo VIP, animado)' });
export const CustomKindParam = z.object({ kind: CustomKind.openapi({ param: { name: 'kind', in: 'path' } }) });
export const CustomIdParam = z.object({ cid: z.uuid().openapi({ param: { name: 'cid', in: 'path' }, description: 'La subida' }) });

/** Proporción del fondo de miniperfil propio: la de la tarjeta del grupo en Jugar, en la computadora (1:2, vertical). */
export const CUSTOM_BG_HELP =
  'Fondo de miniperfil fijo: JPEG, PNG o WebP sin animación, de hasta 2 MB, de proporción 1:2 (vertical, entre 240×480 y 960×1920; ' +
  'el frontend lo recorta). Animado (VIP): GIF, PNG o WebP animados, o MP4 o WebM, de hasta 8 MB; se pasa a WebM de 256×512 y hasta 10 s.';
export const CUSTOM_AVATAR_HELP =
  'GIF, PNG o WebP animados, o MP4 o WebM, de hasta 8 MB. Se recorta cuadrado y se pasa a WebM de 256×256 y hasta 10 s, sin audio.';

const crop = (what: string) => z.coerce.number().int().min(0).max(10_000).optional().openapi({ description: `Recorte: ${what}, en píxeles del original` });
export const CustomUpload = z
  .object({
    file: z.instanceof(File).openapi({ type: 'string', format: 'binary' }),
    price: z.coerce.number().int().min(0).openapi({ description: 'El precio que vio: si cambió, no se cobra' }),
    animated: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true')
      .openapi({ description: 'Solo el fondo: `true` animado (VIP), `false` fijo. El avatar siempre es animado' }),
    rights: z.literal('true', { error: 'Tienes que confirmar que tienes derecho a usar esta imagen.' }).openapi({
      description: 'Confirma «Tengo derecho a usar esta imagen»',
    }),
    crop_x: crop('x'),
    crop_y: crop('y'),
    crop_w: crop('ancho'),
    crop_h: crop('alto'),
  })
  .openapi('CustomUpload');

export const CustomMedia = z
  .object({
    id: z.uuid().openapi({ description: 'La subida: con `custom:<id>` se la pone (PUT /me/cosmetics)' }),
    kind: CustomKind,
    animated: z.boolean(),
    url: z.string(),
    poster_url: z.string().nullable(),
    price: z.number().int().openapi({ description: 'Lo que pagó al subirlo' }),
    currency: Currency,
    created_at: z.string(),
    equipped: z.boolean().openapi({ description: 'Lo tiene puesto' }),
    visible: z.boolean().openapi({ description: 'Se puede usar: lo animado, solo mientras sea VIP' }),
  })
  .openapi('CustomMedia');
const CustomLists = {
  avatar: z.array(CustomMedia).openapi({ description: 'Los avatares guardados, lo más nuevo primero' }),
  background: z.array(CustomMedia).openapi({ description: 'Los fondos de miniperfil guardados, lo más nuevo primero' }),
};
export const MyCustom = z
  .object({
    ...CustomLists,
    max: z.object({ avatar: z.number().int(), background: z.number().int() }).openapi({ description: 'Cuántos guarda de cada tipo' }),
    prices: z.object({ avatar: z.number().int(), background_animated: z.number().int(), background_static: z.number().int() }),
    animated_available: z.boolean().openapi({ description: 'La API puede convertir animaciones (ffmpeg). Si no, solo el fondo fijo' }),
  })
  .openapi('MyCustom');
export const CustomResult = MyCustom.extend({
  id: z.uuid().openapi({ description: 'La subida nueva (ya puesta)' }),
  price_paid: z.number().int(),
  currency: Currency,
  balance: z.number().int().openapi({ description: 'Saldo nuevo de esa moneda' }),
}).openapi('CustomResult');
export const AdminCustom = z
  .object(CustomLists)
  .openapi('AdminCustom', { description: 'Lo propio guardado de una cuenta' });

// ---------- denuncias de imágenes del perfil ----------

export const MEDIA_KINDS = ['avatar', 'background', 'cover'] as const;
export const MEDIA_REASONS = ['copyright', 'nsfw', 'offensive', 'other'] as const;
export const MediaReportBody = z
  .object({
    kind: z.enum(MEDIA_KINDS).openapi({ description: '`avatar` o `background` (los propios) o `cover` (la portada)' }),
    reason: z.enum(MEDIA_REASONS).openapi({ description: '`copyright` (es de otra persona), `nsfw`, `offensive` u `other`' }),
    note: z.string().trim().max(300, 'Hasta 300 caracteres').optional(),
  })
  .openapi('MediaReportBody');
const Ref = z.object({ id: z.uuid(), alias: z.string() });
export const MediaReport = z
  .object({
    id: z.uuid(),
    kind: z.enum(MEDIA_KINDS),
    url: z.string(),
    poster_url: z.string().nullable(),
    reason: z.enum(MEDIA_REASONS),
    note: z.string().nullable(),
    created_at: z.string(),
    status: z.enum(['open', 'dismissed', 'removed']).openapi({ description: '`dismissed`: descartada; `removed`: se sacó la imagen' }),
    resolved_at: z.string().nullable(),
    resolved_by: Ref.nullable(),
    reporter: Ref.nullable(),
    reports: z.number().int().openapi({ description: 'Cuántas denuncias tiene esa imagen' }),
    current: z.boolean().openapi({ description: 'La imagen sigue puesta en el perfil' }),
    profile: Ref.nullable().openapi({ description: 'El perfil de la imagen' }),
  })
  .openapi('MediaReport');
export const MediaReportQuery = listQuery(['created_at'], { sort: 'created_at', order: 'desc' }).extend({
  status: z.enum(['open', 'resolved', 'all']).default('open').openapi({ description: '`open` (por revisar, por defecto), `resolved` o `all`' }),
  kind: z.enum(MEDIA_KINDS).optional(),
  reason: z.enum(MEDIA_REASONS).optional(),
});
export const MediaReportList = Envelope(MediaReport).openapi('MediaReportList');
export const MediaReportResolve = z
  .object({ action: z.enum(['dismiss', 'remove']).openapi({ description: '`dismiss` la descarta; `remove` saca la imagen y avisa al dueño' }) })
  .openapi('MediaReportResolve');
