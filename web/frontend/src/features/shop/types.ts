// Tipos de la tienda, con los nombres de la base (plan docs/bitacora/2026-11-11-economia-puntos).
import type { Source } from "./economy"

export type ItemKind = "frame" | "sticker" | "theme" | "name" | "background"

export interface ShopItem {
  id: string
  kind: ItemKind
  name: string
  description: string | null
  file: string | null
  css_class: string | null
  vip_only: boolean
  /** Viene con el VIP sin comprarlo (el Marco Oro VIP). */
  vip_reward: boolean
  animated: boolean
  collection: string
  price: number | null
  /** Precio en monedas VIP (solo artículos VIP). */
  vip_price: number | null
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
  background: string | null
  stickers: string[]
}

export interface Balance {
  earned: number
  granted: number
  spent: number
  balance: number
}

export type Currency = "points" | "vip"

/** Una fila de point_ledger: cada premio, regalo o compra (plan 2026-11-11-economia-puntos). */
export interface LedgerRow {
  id: number
  at: string
  currency: Currency
  amount: number
  source: Source
  label: string
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
  vip_balance: number
}

export const KINDS: Record<ItemKind, string> = {
  frame: "Marcos",
  sticker: "Stickers",
  theme: "Temas",
  name: "Nombres",
  background: "Fondos",
}

export const COLLECTIONS: Record<string, string> = {
  cs: "Counter-Strike",
  paises: "Sudamérica",
  series: "Series míticas",
  paises2: "Latinoamérica y España",
  mapas: "Mapas de CS:S",
  arsenal: "Arsenal",
  series2: "Series míticas 2",
  vip: "VIP",
}

// Los archivos de los marcos, stickers y fondos están en public/cosmetics/.
export const COSMETICS_BASE = "/cosmetics/"
