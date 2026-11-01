import { useCallback, useEffect, useMemo, useState } from "react"

import type {
  AdminAccount,
  Balance,
  CatalogItem,
  Currency,
  Equipped,
  HistoryRow,
  Points,
  PointsConfig,
  ShopItem,
} from "./types"
import { COSMETICS_BASE } from "./types"

// Tienda de ejemplo en memoria, con las mismas reglas que la base (shop_buy, set_my_cosmetics,
// shop_weekly y points_of de 20261029180000_tienda.sql). Sin API ni sesión.

type CatalogFile = { items: Omit<ShopItem, "price" | "active">[] }
type Override = { price?: number | null; vip_price?: number | null; active?: boolean }

// Precios iniciales: los de generar_catalogo_sql.py.
function basePrice(i: Omit<ShopItem, "price" | "active">): number | null {
  if (i.vip_only) return null
  const cs = i.collection === "cs"
  if (i.kind === "sticker") return cs ? 150 : 200
  if (i.kind === "name") return cs ? (i.animated ? 600 : 500) : 400
  if (i.kind === "theme") return cs ? 700 : 600
  if (i.kind === "background") return cs ? 1000 : 800
  if (cs) return i.animated ? 1200 : 900
  return i.collection.startsWith("paises") ? 1000 : 900
}

const START_CONFIG: PointsConfig = {
  per_mix: 10,
  per_win: 5,
  vip_multiplier: 1,
  weekly_count: 6,
  weekly_discount: 25,
  vip_per_mix: 10,
  vip_per_win: 5,
}

const START_OWNED = ["marco-fuego", "sticker-gg", "tema-pais-ar", "nombre-brillo", "fondo-neon"]
const START_EQUIPPED: Equipped = {
  frame: "marco-fuego",
  theme: "tema-pais-ar",
  name: "nombre-brillo",
  background: "fondo-neon",
  stickers: ["sticker-gg"],
}
const MAPS = ["de_dust2", "de_inferno", "de_nuke", "de_train", "cs_office"]

// 110 mixes; los 40 más nuevos, jugados siendo VIP (el VIP se venció: las monedas quedan congeladas).
function startHistory(): HistoryRow[] {
  const now = Date.now()
  return Array.from({ length: 110 }, (_, k) => {
    const won = k % 3 !== 1
    const row = {
      kind: "mix" as const,
      at: new Date(now - (k + 1) * 9 * 3600_000).toISOString(),
      label: MAPS[k % MAPS.length] + (won ? " · victoria" : ""),
      vip: k < 40,
    }
    const rows: HistoryRow[] = [{ ...row, points: won ? 15 : 10, currency: "points" }]
    if (row.vip) rows.push({ ...row, points: won ? 15 : 10, currency: "vip" })
    return rows
  }).flat()
}

const ACCOUNTS: AdminAccount[] = [
  ["v34|Pepon", true, 2140, 132],
  ["Kyan", true, 1890, 118],
  ["chiquitoAWP", false, 640, 51],
  ["la_bomba", false, 1210, 90],
  ["Tóxico99", false, 310, 22],
  ["flashero", false, 95, 9],
].map(([alias, vip, earned, mixes], k) => ({
  user_id: `demo-${k}`,
  alias: alias as string,
  vip: vip as boolean,
  earned: earned as number,
  granted: 0,
  spent: 0,
  balance: earned as number,
  mixes: mixes as number,
  items: 0,
  vip_balance: vip ? Math.round((earned as number) * 0.4) : 0,
}))

// La semana ISO, como semilla de las ofertas (shop_weekly mezcla con md5(id || semana)).
function isoWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y = t.getUTCFullYear()
  const w = Math.ceil(((+t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)
  return `${y}-${String(w).padStart(2, "0")}`
}
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function nextMonday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
  return d
}

export type ShopDemo = ReturnType<typeof useShopDemo>

export function useShopDemo() {
  const [raw, setRaw] = useState<CatalogFile["items"] | null>(null)
  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [config, setConfig] = useState<PointsConfig>(START_CONFIG)
  const [vip, setVip] = useState(false)
  const [owned, setOwned] = useState<string[]>(START_OWNED)
  const [equipped, setEquipped] = useState<Equipped>(START_EQUIPPED)
  const [history, setHistory] = useState<HistoryRow[]>(startHistory)
  const [accounts, setAccounts] = useState<AdminAccount[]>(ACCOUNTS)
  const [cover, setCover] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(COSMETICS_BASE + "catalogo.json")
      .then((r) => r.json() as Promise<CatalogFile>)
      .then((c) => alive && setRaw(c.items))
      .catch(() => alive && setRaw([]))
    return () => {
      alive = false
    }
  }, [])

  const items: ShopItem[] = useMemo(
    () =>
      (raw ?? []).map((i) => ({
        ...i,
        price:
          overrides[i.id]?.price !== undefined
            ? (overrides[i.id].price ?? null)
            : basePrice(i),
        vip_price:
          overrides[i.id]?.vip_price !== undefined ? (overrides[i.id].vip_price ?? null) : i.vip_price,
        active: overrides[i.id]?.active ?? true,
      })),
    [raw, overrides],
  )
  const byId = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i])),
    [items],
  )

  const catalog: CatalogItem[] = useMemo(() => {
    const week = isoWeek()
    const weekly = new Set(
      items
        .filter((i) => i.active && i.price != null && !i.vip_only)
        .sort((a, b) => hash(a.id + week) - hash(b.id + week))
        .slice(0, config.weekly_count)
        .map((i) => i.id),
    )
    return items
      .filter((i) => i.active)
      .map((i) => {
        const w = weekly.has(i.id)
        return {
          ...i,
          base_price: i.price,
          weekly: w,
          price:
            i.price == null
              ? null
              : w
                ? Math.max(1, Math.round((i.price * (100 - config.weekly_discount)) / 100))
                : i.price,
        }
      })
  }, [items, config.weekly_count, config.weekly_discount])
  const catalogById = useMemo(
    () => Object.fromEntries(catalog.map((i) => [i.id, i])),
    [catalog],
  )

  // points_of y vip_coins_of: cada moneda por separado.
  function balanceOf(currency: Currency): Balance {
    const rows = history.filter((h) => h.currency === currency)
    const sum = (kind: HistoryRow["kind"]) =>
      rows.filter((h) => h.kind === kind).reduce((s, h) => s + h.points, 0)
    const earned = sum("mix")
    const granted = sum("grant")
    const spent = -sum("purchase") || 0
    return {
      earned,
      granted,
      spent,
      balance: earned + granted - spent,
      mixes: rows.filter((h) => h.kind === "mix").length,
    }
  }
  const points: Points = { ...balanceOf("points"), vip, vip_coins: balanceOf("vip") }

  // can_use_item: el premio VIP mientras sea VIP; lo demás si lo tiene, y lo VIP solo siendo VIP.
  const canUse = useCallback(
    (i: ShopItem) => (i.vip_reward ? vip : owned.includes(i.id) && (!i.vip_only || vip)),
    [owned, vip],
  )
  // Lo que se ve: sin lo VIP si la cuenta dejó de ser VIP (como player_cosmetics_public).
  const visible: Equipped = useMemo(() => {
    const ok = (id: string | null) => (id && byId[id] && canUse(byId[id]) ? id : null)
    return {
      frame: ok(equipped.frame),
      theme: ok(equipped.theme),
      name: ok(equipped.name),
      background: ok(equipped.background),
      stickers: equipped.stickers.filter((s) => ok(s)),
    }
  }, [equipped, byId, canUse])

  // shop_buy: los mismos rechazos que la función de la base.
  function buy(id: string): string | null {
    const i = byId[id]
    const c = catalogById[id]
    if (!i || !c) return "Ese artículo no está en la tienda"
    if (i.vip_reward) return "Ese artículo viene con el VIP: no se compra"
    if (owned.includes(id)) return "Ya lo tenés"
    if (i.vip_only && !vip) return "Los artículos VIP se compran siendo VIP"
    const currency: Currency = i.vip_only ? "vip" : "points"
    const price = i.vip_only ? i.vip_price : c.price
    if (price == null) return "Ese artículo no está a la venta"
    const bal = i.vip_only ? points.vip_coins.balance : points.balance
    if (bal < price) return `Te faltan ${price - bal} ${i.vip_only ? "monedas VIP" : "puntos"}`
    setOwned((o) => [...o, id])
    setHistory((h) => [
      { kind: "purchase", at: new Date().toISOString(), points: -price, label: i.name, vip: false, currency },
      ...h,
    ])
    return null
  }

  // set_my_cosmetics: un artículo por tipo y hasta 3 stickers.
  function equip(id: string, on: boolean): string | null {
    const i = byId[id]
    if (!i) return "No existe ese artículo"
    if (on && !canUse(i)) return "Todavía no tenés ese artículo"
    setEquipped((e) => {
      if (i.kind !== "sticker") return { ...e, [i.kind]: on ? id : null }
      const s = e.stickers.filter((x) => x !== id)
      if (on) s.push(id)
      return { ...e, stickers: s.slice(-3) }
    })
    return null
  }

  function playMix(won: boolean) {
    const p = Math.round(
      (config.per_mix + (won ? config.per_win : 0)) * (vip ? config.vip_multiplier : 1),
    )
    const coins = vip ? config.vip_per_mix + (won ? config.vip_per_win : 0) : 0
    const row = {
      kind: "mix" as const,
      at: new Date().toISOString(),
      label: MAPS[Math.floor(Math.random() * MAPS.length)] + (won ? " · victoria" : ""),
      vip,
    }
    setHistory((h) => [
      ...(coins ? [{ ...row, points: coins, currency: "vip" as const }] : []),
      { ...row, points: p, currency: "points" as const },
      ...h,
    ])
    return { points: p, coins }
  }

  function grant(amount: number, reason: string, currency: Currency = "points") {
    setHistory((h) => [
      { kind: "grant", at: new Date().toISOString(), points: amount, label: reason, vip: false, currency },
      ...h,
    ])
  }

  function updateItem(id: string, patch: Override) {
    setOverrides((o) => ({ ...o, [id]: { ...o[id], ...patch } }))
  }

  function adminAccount(userId: string, patch: Partial<AdminAccount>) {
    setAccounts((a) =>
      a.map((x) => {
        if (x.user_id !== userId) return x
        const n = { ...x, ...patch }
        n.balance = n.earned + n.granted - n.spent
        return n
      }),
    )
  }

  function reset() {
    setOverrides({})
    setConfig(START_CONFIG)
    setVip(false)
    setOwned(START_OWNED)
    setEquipped(START_EQUIPPED)
    setHistory(startHistory())
    setAccounts(ACCOUNTS)
    setCover(null)
  }

  return {
    loading: raw === null,
    items,
    byId,
    catalog,
    catalogById,
    config,
    setConfig,
    vip,
    setVip,
    owned,
    equipped,
    visible,
    points,
    history,
    accounts,
    cover,
    setCover,
    canUse,
    buy,
    equip,
    playMix,
    grant,
    updateItem,
    adminAccount,
    reset,
  }
}
