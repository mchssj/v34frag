import type { Schemas } from "@/api/client"

// Tienda de cosméticos (replanteo 113, bitácora 2026-11-11-tienda-de-puntos). Los tipos salen de la API;
// los nombres de los tipos y colecciones son los de public/cosmetics/catalogo.json.

// Los esquemas con nombre que la API usa con .nullable() salen nulos en el schema generado (pasa también con
// VipStatus): acá se usan sin el null.
export type Cosmetic = NonNullable<Schemas["Cosmetic"]>
export type ShopItem = Schemas["ShopItem"]
export type ItemKind = ShopItem["kind"]
export type Points = Schemas["Points"]
export type PointsConfig = Schemas["PointsConfig"]
export type Equipped = Schemas["Equipped"]
export type CosmeticsLight = NonNullable<Schemas["CosmeticsLight"]>
export type CosmeticsFull = NonNullable<Schemas["CosmeticsFull"]>

/**
 * Lo mínimo para dibujar un cosmético (sirve un Cosmetic de la ficha o un ShopItem del catálogo). Lo propio
 * (id `custom`, bitácora 2026-11-13-avatar-y-fondo-propios) trae `url` y `poster_url` en vez de `file`.
 */
export type Drawable = Pick<
  Cosmetic,
  "id" | "kind" | "name" | "file" | "css_class" | "url" | "poster_url"
>
/** Lo que hace falta para el archivo de un cosmético: el de /cosmetics/ o el subido. */
export type Media = Pick<Cosmetic, "file" | "url" | "poster_url">
export type MyCustom = Schemas["MyCustom"]
export type CustomMedia = NonNullable<Schemas["CustomMedia"]>
export type CustomKind = CustomMedia["kind"]

export const KINDS: Record<ItemKind, string> = {
  frame: "Marcos",
  avatar: "Avatares",
  sticker: "Stickers",
  theme: "Temas",
  name: "Nombres",
  background: "Fondos de miniperfil",
}

export const COLLECTIONS: Record<string, string> = {
  cs: "Counter-Strike",
  paises: "Sudamérica",
  series: "Series míticas",
  paises2: "Latinoamérica y España",
  mapas: "Mapas de CS:S",
  arsenal: "Arsenal",
  series2: "Series míticas 2",
  anime: "Anime",
  memes: "Memes",
  tactico: "Equipo táctico",
  texturas: "Texturas",
  vip: "VIP",
}

// Los archivos de los marcos, stickers y fondos están en public/cosmetics/. Lo propio, en el bucket cosmetics (url).
export const COSMETICS_BASE = "/cosmetics/"
export const fileUrl = (i?: Partial<Media> | null) =>
  i?.url ? i.url : i?.file ? COSMETICS_BASE + i.file : null

/** La imagen fija de un avatar animado: el .webp con el mismo nombre que su .webm (o la que trae lo propio). */
export const posterUrl = (i?: Partial<Media> | null) =>
  i?.url
    ? (i.poster_url ?? i.url)
    : i?.file
      ? COSMETICS_BASE + i.file.replace(/\.webm$/, ".webp")
      : null

/** Una subida propia como un cosmético que se puede dibujar (null si no se puede usar: animada sin VIP). */
export function customDrawable(
  c: CustomMedia | null | undefined
): Drawable | null {
  if (!c?.visible) return null
  return {
    id: "custom",
    kind: c.kind,
    name: c.kind === "avatar" ? "Tu avatar" : "Tu fondo de miniperfil",
    file: null,
    css_class: null,
    url: c.url,
    poster_url: c.poster_url,
  }
}
