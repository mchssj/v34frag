import type { CatalogItem, Currency, ItemKind, ShopItem } from "./types"

// Economía de puntos y monedas VIP (docs/bitacora/2026-11-11-economia-puntos/PLAN.md): de dónde sale cada
// premio y cuánto da. En la base, points_config; acá, los valores iniciales.

export type Source =
  | "match"
  | "match_win"
  | "first_of_day"
  | "official"
  | "tournament"
  | "medal"
  | "season"
  | "level_up"
  | "mission"
  | "mission_vip"
  | "first_steps"
  | "clip_featured"
  | "referral"
  | "vip_welcome"
  | "grant"
  | "purchase"

export type Metal = "bronce" | "plata" | "oro" | "platino" | "diamante"
export const METALS: Metal[] = ["bronce", "plata", "oro", "platino", "diamante"]

export interface SourceRule {
  points: number
  vip: number
  enabled: boolean
}

export interface EconomyConfig {
  rules: Record<
    Exclude<Source, "grant" | "purchase" | "medal" | "season" | "tournament">,
    SourceRule
  >
  medal: Record<Metal, { points: number; vip: number }>
  /** Por puesto: hasta qué puesto (inclusive) da cada premio. */
  season: { upTo: number; points: number; vip: number }[]
  tournament: { champion: SourceRule; runnerUp: SourceRule }
  /** Partidas por día que dan premio (match, match_win y first_of_day). */
  daily_match_cap: number
  weekly_count: number
  weekly_discount: number
  /** Descuento de un pack sobre la suma de lo que falta. */
  bundle_discount: number
}

export const START_ECONOMY: EconomyConfig = {
  rules: {
    match: { points: 10, vip: 10, enabled: true },
    match_win: { points: 5, vip: 5, enabled: true },
    first_of_day: { points: 10, vip: 10, enabled: true },
    official: { points: 15, vip: 10, enabled: true },
    level_up: { points: 50, vip: 25, enabled: true },
    mission: { points: 30, vip: 0, enabled: true },
    mission_vip: { points: 0, vip: 50, enabled: true },
    first_steps: { points: 20, vip: 0, enabled: true },
    clip_featured: { points: 50, vip: 25, enabled: true },
    // Espera el sistema de referidos.
    referral: { points: 100, vip: 50, enabled: false },
    vip_welcome: { points: 0, vip: 100, enabled: true },
  },
  medal: {
    bronce: { points: 50, vip: 25 },
    plata: { points: 100, vip: 50 },
    oro: { points: 200, vip: 100 },
    platino: { points: 400, vip: 200 },
    diamante: { points: 800, vip: 400 },
  },
  season: [
    { upTo: 1, points: 1000, vip: 500 },
    { upTo: 2, points: 750, vip: 375 },
    { upTo: 3, points: 500, vip: 250 },
    { upTo: 10, points: 250, vip: 125 },
    { upTo: 20, points: 100, vip: 50 },
  ],
  tournament: {
    champion: { points: 500, vip: 250, enabled: true },
    runnerUp: { points: 250, vip: 125, enabled: true },
  },
  daily_match_cap: 10,
  weekly_count: 6,
  weekly_discount: 25,
  bundle_discount: 20,
}

export const SOURCE_LABEL: Record<Source, string> = {
  match: "Partida jugada",
  match_win: "Victoria",
  first_of_day: "Primera partida del día",
  official: "Partida oficial de torneo",
  tournament: "Torneo",
  medal: "Medalla",
  season: "Fin de temporada",
  level_up: "Nivel nuevo",
  mission: "Misión semanal",
  mission_vip: "Misión VIP",
  first_steps: "Primeros pasos",
  clip_featured: "Clip destacado",
  referral: "Amigo invitado",
  vip_welcome: "Bienvenida VIP",
  grant: "Regalo",
  purchase: "Compra",
}

export function seasonPrize(cfg: EconomyConfig, rank: number) {
  return cfg.season.find((s) => rank <= s.upTo) ?? null
}

// ---------- Rareza ----------
// No se guarda: sale del precio, en la moneda que corresponda. El premio VIP es aparte.

export type Rarity = "comun" | "rara" | "epica" | "legendaria" | "vip"

export const RARITY: Record<
  Rarity,
  { label: string; text: string; bar: string; ring: string }
> = {
  comun: {
    label: "Común",
    text: "text-muted-foreground",
    bar: "bg-muted-foreground/50",
    ring: "",
  },
  rara: {
    label: "Rara",
    text: "text-sky-500",
    bar: "bg-sky-500",
    ring: "ring-sky-500/40",
  },
  epica: {
    label: "Épica",
    text: "text-violet-500",
    bar: "bg-violet-500",
    ring: "ring-violet-500/40",
  },
  legendaria: {
    label: "Legendaria",
    text: "text-rose-500",
    bar: "bg-rose-500",
    ring: "ring-rose-500/40",
  },
  vip: {
    label: "VIP",
    text: "text-[#e8b53a]",
    bar: "bg-[#e8b53a]",
    ring: "ring-[#e8b53a]/50",
  },
}

export function rarityOf(
  i: Pick<
    ShopItem,
    "vip_reward" | "vip_only" | "vip_price" | "kind" | "animated"
  > & {
    base_price?: number | null
    price: number | null
  }
): Rarity {
  if (i.vip_reward) return "vip"
  const p = (i.vip_only ? i.vip_price : (i.base_price ?? i.price)) ?? 0
  if (p >= 1000 && i.animated) return "legendaria"
  if (p >= 800) return "epica"
  if (p >= 400) return "rara"
  return "comun"
}

// ---------- Packs ----------
// Un pack junta los artículos de una misma colección temática (pais-ar, serie-ninja, mapa-dust2…). Se paga
// solo lo que falta, con descuento. Lo VIP va en monedas VIP.

export interface Bundle {
  id: string
  name: string
  collection: string
  currency: Currency
  items: CatalogItem[]
  /** Lo que falta comprar. */
  missing: CatalogItem[]
  full: number
  price: number
}

const KIND_ORDER: ItemKind[] = [
  "frame",
  "background",
  "theme",
  "name",
  "sticker",
]

/** La clave temática de un artículo: lo que queda del id sin el prefijo del tipo. */
export function themeKey(i: Pick<ShopItem, "id">): string {
  return i.id.replace(/^(marco|sticker|tema|nombre|fondo)-/, "")
}

export function buildBundles(
  catalog: CatalogItem[],
  owned: string[],
  discount: number
): Bundle[] {
  const groups = new Map<string, CatalogItem[]>()
  for (const c of catalog) {
    if (c.vip_reward) continue
    const k = themeKey(c)
    groups.set(k, [...(groups.get(k) ?? []), c])
  }
  const out: Bundle[] = []
  for (const [k, items] of groups) {
    if (items.length < 3) continue
    const currency: Currency = items.every((i) => i.vip_only) ? "vip" : "points"
    if (currency === "points" && items.some((i) => i.vip_only)) continue
    const cost = (i: CatalogItem) =>
      (currency === "vip" ? i.vip_price : i.base_price) ?? 0
    if (items.some((i) => cost(i) <= 0)) continue
    items.sort(
      (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
    )
    const missing = items.filter((i) => !owned.includes(i.id))
    const full = missing.reduce((s, i) => s + cost(i), 0)
    const head = items.find((i) => i.kind === "frame") ?? items[0]!
    out.push({
      id: `pack-${k}`,
      name: head.name,
      collection: head.collection,
      currency,
      items,
      missing,
      full,
      price: Math.round((full * (100 - discount)) / 100),
    })
  }
  return out
}

export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

// La semana ISO, como semilla de las ofertas (shop_weekly mezcla con md5(id || semana)).
export function isoWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y = t.getUTCFullYear()
  const w = Math.ceil(((+t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)
  return `${y}-${String(w).padStart(2, "0")}`
}

export function nextMonday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
  return d
}

/** "4 d 7 h" o "7 h 12 min" hasta una fecha. */
export function timeLeft(to: Date, now = new Date()): string {
  const m = Math.max(0, Math.floor((+to - +now) / 60000))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return d ? `${d} d ${h} h` : `${h} h ${m % 60} min`
}
