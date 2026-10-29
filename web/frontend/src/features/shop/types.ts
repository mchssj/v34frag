// Tipos de la tienda, con los nombres de la base (supabase/migrations/20261029180000_tienda.sql en kyan/pruebas).

export type ItemKind = "frame" | "sticker" | "theme" | "name"

export interface ShopItem {
  id: string
  kind: ItemKind
  name: string
  description: string | null
  file: string | null
  css_class: string | null
  vip_only: boolean
  animated: boolean
  collection: string
  price: number | null
  active: boolean
}

// Una fila de shop_catalog: el artículo con el precio de hoy.
export interface CatalogItem extends ShopItem {
  base_price: number | null
  weekly: boolean
}

export interface Equipped {
  frame: string | null
  theme: string | null
  name: string | null
  stickers: string[]
}

export interface PointsConfig {
  per_mix: number
  per_win: number
  vip_multiplier: number
  weekly_count: number
  weekly_discount: number
}

export interface Points {
  earned: number
  granted: number
  spent: number
  balance: number
  mixes: number
  vip: boolean
}

export interface HistoryRow {
  kind: "mix" | "grant" | "purchase"
  at: string
  points: number
  label: string
  vip: boolean
}

export interface AdminAccount {
  user_id: string
  alias: string
  vip: boolean
  balance: number
  earned: number
  granted: number
  spent: number
  mixes: number
  items: number
}

export const KINDS: Record<ItemKind, string> = {
  frame: "Marcos",
  sticker: "Stickers",
  theme: "Temas",
  name: "Nombres",
}

export const COLLECTIONS: Record<string, string> = {
  cs: "Counter-Strike",
  paises: "Sudamérica",
  series: "Series míticas",
  paises2: "Latinoamérica y España",
  mapas: "Mapas de CS:S",
  arsenal: "Arsenal",
  series2: "Series míticas 2",
}

// Los archivos de los marcos y stickers están en public/cosmetics/.
export const COSMETICS_BASE = "/cosmetics/"
