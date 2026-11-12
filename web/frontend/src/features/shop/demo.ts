import { useCallback, useEffect, useMemo, useState } from "react"

import {
  buildBundles,
  hash,
  isoWeek,
  seasonPrize,
  SOURCE_LABEL,
  START_ECONOMY,
  type Bundle,
  type EconomyConfig,
  type Metal,
  type Source,
} from "./economy"
import type {
  AdminAccount,
  Balance,
  CatalogItem,
  Currency,
  Equipped,
  LedgerRow,
  ShopItem,
} from "./types"
import { COSMETICS_BASE } from "./types"

// Tienda de ejemplo en memoria con las reglas del plan 2026-11-11-economia-puntos: cada premio es una fila del
// registro (point_ledger), el tope diario de partidas, las monedas VIP solo siendo VIP y las compras como filas
// negativas. Sin API ni sesión.

type CatalogFile = { items: Omit<ShopItem, "price" | "active">[] }
type Override = {
  price?: number | null
  vip_price?: number | null
  active?: boolean
}

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

const START_OWNED = [
  "marco-fuego",
  "sticker-gg",
  "tema-pais-ar",
  "nombre-brillo",
  "fondo-neon",
]
const START_EQUIPPED: Equipped = {
  frame: "marco-fuego",
  theme: "tema-pais-ar",
  name: "nombre-brillo",
  background: "fondo-neon",
  stickers: ["sticker-gg"],
}
const START_WISH = ["marco-pais-br", "fondo-mapa-dust2"]
const MAPS = [
  "de_dust2",
  "de_inferno",
  "de_nuke",
  "de_train",
  "cs_office",
  "de_aztec",
]

let seq = 0
const row = (
  at: number,
  source: Source,
  currency: Currency,
  amount: number,
  label: string
): LedgerRow => ({
  id: ++seq,
  at: new Date(at).toISOString(),
  currency,
  amount,
  source,
  label,
})

// Tres semanas desde que se implementó: partidas, una medalla, misiones y Primeros pasos. Los primeros 10 días
// fue VIP (las monedas quedan congeladas hasta que vuelva a serlo).
function startLedger(): LedgerRow[] {
  const now = Date.now()
  const out: LedgerRow[] = []
  for (let d = 21; d >= 1; d--) {
    const day = now - d * 86400_000
    const vip = d > 11
    const n = 1 + (hash(String(d)) % 3)
    for (let k = 0; k < n; k++) {
      const at = day + k * 3600_000
      const won = (d + k) % 3 !== 1
      const map = MAPS[(d + k) % MAPS.length]!
      const label = `Matchmaking · ${map}`
      out.push(row(at, "match", "points", 10, label))
      if (won) out.push(row(at, "match_win", "points", 5, label))
      if (k === 0)
        out.push(row(at, "first_of_day", "points", 10, "Primera del día"))
      if (vip) {
        out.push(row(at, "match", "vip", 10, label))
        if (won) out.push(row(at, "match_win", "vip", 5, label))
        if (k === 0)
          out.push(row(at, "first_of_day", "vip", 10, "Primera del día"))
      }
    }
    if (d === 20) out.push(row(day, "vip_welcome", "vip", 100, "Mes de VIP"))
    if (d % 7 === 3)
      out.push(
        row(
          day + 7200_000,
          "mission",
          "points",
          30,
          "Misión: 3 victorias en la semana"
        )
      )
    if (d === 18)
      out.push(
        row(
          day,
          "first_steps",
          "points",
          20,
          "Primeros pasos: completar el perfil"
        )
      )
    if (d === 15)
      out.push(
        row(
          day + 9000_000,
          "medal",
          "points",
          100,
          "Medalla de plata: 100 headshots"
        )
      )
    if (d === 15)
      out.push(
        row(
          day + 9000_000,
          "medal",
          "vip",
          50,
          "Medalla de plata: 100 headshots"
        )
      )
    if (d === 9) out.push(row(day, "level_up", "points", 50, "Nivel 7"))
  }
  return out.reverse()
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

const dayKey = (d: Date) =>
  d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

export type ShopDemo = ReturnType<typeof useShopDemo>
export type Awarded = { points: number; vip: number; capped: boolean }

export function useShopDemo() {
  const [raw, setRaw] = useState<CatalogFile["items"] | null>(null)
  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [config, setConfig] = useState<EconomyConfig>(START_ECONOMY)
  const [vip, setVipState] = useState(false)
  const [owned, setOwned] = useState<string[]>(START_OWNED)
  const [equipped, setEquipped] = useState<Equipped>(START_EQUIPPED)
  const [ledger, setLedger] = useState<LedgerRow[]>(startLedger)
  const [accounts, setAccounts] = useState<AdminAccount[]>(ACCOUNTS)
  const [cover, setCover] = useState<string | null>(null)
  const [wish, setWish] = useState<string[]>(START_WISH)
  // El "día" del demo: "Pasar al día siguiente" lo adelanta para probar el tope y la primera del día.
  const [dayOffset, setDayOffset] = useState(0)
  const [level, setLevel] = useState(7)

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

  // Hora de entrada a la página: el "hoy" del render no puede leer el reloj.
  const [opened] = useState(() => Date.now())
  const now = () => Date.now() + dayOffset * 86400_000
  const today = dayKey(new Date(opened + dayOffset * 86400_000))

  const items: ShopItem[] = useMemo(
    () =>
      (raw ?? []).map((i) => ({
        ...i,
        price:
          overrides[i.id]?.price !== undefined
            ? (overrides[i.id]!.price ?? null)
            : basePrice(i),
        vip_price:
          overrides[i.id]?.vip_price !== undefined
            ? (overrides[i.id]!.vip_price ?? null)
            : i.vip_price,
        active: overrides[i.id]?.active ?? true,
      })),
    [raw, overrides]
  )
  const byId = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i])),
    [items]
  )

  const catalog: CatalogItem[] = useMemo(() => {
    const week = isoWeek()
    const weekly = new Set(
      items
        .filter((i) => i.active && i.price != null && !i.vip_only)
        .sort((a, b) => hash(a.id + week) - hash(b.id + week))
        .slice(0, config.weekly_count)
        .map((i) => i.id)
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
                ? Math.max(
                    1,
                    Math.round((i.price * (100 - config.weekly_discount)) / 100)
                  )
                : i.price,
        }
      })
  }, [items, config.weekly_count, config.weekly_discount])
  const catalogById = useMemo(
    () => Object.fromEntries(catalog.map((i) => [i.id, i])),
    [catalog]
  )

  const bundles: Bundle[] = useMemo(
    () => buildBundles(catalog, owned, config.bundle_discount),
    [catalog, owned, config.bundle_discount]
  )
  // Los packs de la semana: 4 con algo por comprar, elegidos con la semana como semilla.
  const weeklyBundles = useMemo(() => {
    const week = isoWeek()
    return bundles
      .filter((b) => b.missing.length)
      .sort((a, b) => hash(a.id + week) - hash(b.id + week))
      .slice(0, 4)
  }, [bundles])

  const balanceOf = useCallback(
    (currency: Currency): Balance => {
      let earned = 0
      let granted = 0
      let spent = 0
      for (const r of ledger) {
        if (r.currency !== currency) continue
        if (r.source === "purchase") spent -= r.amount
        else if (r.source === "grant") granted += r.amount
        else earned += r.amount
      }
      return { earned, granted, spent, balance: earned + granted - spent }
    },
    [ledger]
  )
  const points = balanceOf("points")
  const coins = balanceOf("vip")

  // Partidas de hoy que ya dieron premio (match en puntos, una por partida).
  const matchesToday = ledger.filter(
    (r) =>
      r.source === "match" &&
      r.currency === "points" &&
      dayKey(new Date(r.at)) === today
  ).length

  // can_use_item: el premio VIP mientras sea VIP; lo demás si lo tiene, y lo VIP solo siendo VIP.
  const canUse = useCallback(
    (i: ShopItem) =>
      i.vip_reward ? vip : owned.includes(i.id) && (!i.vip_only || vip),
    [owned, vip]
  )
  // Lo que se ve: sin lo VIP si la cuenta dejó de ser VIP (como player_cosmetics_public).
  const visible: Equipped = useMemo(() => {
    const ok = (id: string | null) =>
      id && byId[id] && canUse(byId[id]) ? id : null
    return {
      frame: ok(equipped.frame),
      theme: ok(equipped.theme),
      name: ok(equipped.name),
      background: ok(equipped.background),
      stickers: equipped.stickers.filter((s) => ok(s)),
    }
  }, [equipped, byId, canUse])

  // points_award: una fila por moneda; las monedas VIP, solo siendo VIP.
  function award(
    source: Source,
    label: string,
    pts: number,
    vipCoins: number,
    isVip = vip
  ): Awarded {
    const at = now()
    const rows: LedgerRow[] = []
    if (pts) rows.push(row(at, source, "points", pts, label))
    if (vipCoins && isVip) rows.push(row(at, source, "vip", vipCoins, label))
    setLedger((l) => [...rows, ...l])
    return { points: pts, vip: isVip ? vipCoins : 0, capped: false }
  }

  // award_match: partida + victoria + primera del día, con el tope diario.
  function playMatch(won: boolean, official = false): Awarded {
    if (matchesToday >= config.daily_match_cap)
      return { points: 0, vip: 0, capped: true }
    const map = MAPS[Math.floor(Math.random() * MAPS.length)]!
    const label = `${official ? "Oficial" : "Matchmaking"} · ${map}`
    const r = config.rules
    const parts: [Source, string, number, number][] = []
    const base = official ? r.official : r.match
    if (base.enabled) parts.push(["match", label, base.points, base.vip])
    if (won && r.match_win.enabled)
      parts.push(["match_win", label, r.match_win.points, r.match_win.vip])
    if (matchesToday === 0 && r.first_of_day.enabled)
      parts.push([
        "first_of_day",
        "Primera del día",
        r.first_of_day.points,
        r.first_of_day.vip,
      ])
    const at = now()
    const rows: LedgerRow[] = []
    let pts = 0
    let v = 0
    for (const [s, l, p, c] of parts) {
      rows.push(row(at, s, "points", p, l))
      pts += p
      if (vip && c) {
        rows.push(row(at, s, "vip", c, l))
        v += c
      }
    }
    setLedger((l) => [...rows.reverse(), ...l])
    return { points: pts, vip: v, capped: false }
  }

  function earnMedal(metal: Metal) {
    const m = config.medal[metal]
    return award("medal", `Medalla de ${metal}`, m.points, m.vip)
  }
  function closeSeason(rank: number) {
    const p = seasonPrize(config, rank)
    if (!p) return { points: 0, vip: 0, capped: false }
    return award("season", `Temporada 2 · puesto ${rank}`, p.points, p.vip)
  }
  function simple(
    source: Exclude<
      Source,
      "medal" | "season" | "tournament" | "grant" | "purchase"
    >,
    label: string
  ) {
    const r = config.rules[source]
    if (!r.enabled) return { points: 0, vip: 0, capped: false }
    return award(source, label, r.points, r.vip)
  }
  function levelUp() {
    const n = Math.min(10, level + 1)
    setLevel(n)
    return simple("level_up", `Nivel ${n}`)
  }
  function tournament(champion: boolean) {
    const r = champion ? config.tournament.champion : config.tournament.runnerUp
    return award(
      "tournament",
      champion ? "Campeón del torneo" : "Subcampeón del torneo",
      r.points,
      r.vip
    )
  }

  function setVip(on: boolean) {
    setVipState(on)
    // vip_welcome: cada mes de VIP que empieza.
    if (on && config.rules.vip_welcome.enabled)
      award("vip_welcome", "Mes de VIP", 0, config.rules.vip_welcome.vip, true)
  }

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
    const bal = i.vip_only ? coins.balance : points.balance
    if (bal < price)
      return `Te faltan ${price - bal} ${i.vip_only ? "monedas VIP" : "puntos"}`
    setOwned((o) => [...o, id])
    setLedger((l) => [row(now(), "purchase", currency, -price, i.name), ...l])
    return null
  }

  function buyBundle(b: Bundle): string | null {
    if (!b.missing.length) return "Ya tenés todo el pack"
    if (b.currency === "vip" && !vip)
      return "Los packs VIP se compran siendo VIP"
    const bal = b.currency === "vip" ? coins.balance : points.balance
    if (bal < b.price)
      return `Te faltan ${b.price - bal} ${b.currency === "vip" ? "monedas VIP" : "puntos"}`
    setOwned((o) => [...o, ...b.missing.map((i) => i.id)])
    setLedger((l) => [
      row(now(), "purchase", b.currency, -b.price, `Pack ${b.name}`),
      ...l,
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

  function toggleWish(id: string) {
    setWish((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))
  }

  function grant(
    amount: number,
    reason: string,
    currency: Currency = "points"
  ) {
    setLedger((l) => [row(now(), "grant", currency, amount, reason), ...l])
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
      })
    )
  }

  function reset() {
    setOverrides({})
    setConfig(START_ECONOMY)
    setVipState(false)
    setOwned(START_OWNED)
    setEquipped(START_EQUIPPED)
    setLedger(startLedger())
    setAccounts(ACCOUNTS)
    setCover(null)
    setWish(START_WISH)
    setDayOffset(0)
    setLevel(7)
  }

  return {
    loading: raw === null,
    items,
    byId,
    catalog,
    catalogById,
    bundles,
    weeklyBundles,
    config,
    setConfig,
    vip,
    setVip,
    owned,
    equipped,
    visible,
    points,
    coins,
    ledger,
    matchesToday,
    level,
    accounts,
    cover,
    setCover,
    wish,
    toggleWish,
    canUse,
    buy,
    buyBundle,
    equip,
    playMatch,
    earnMedal,
    closeSeason,
    levelUp,
    tournament,
    completeMission: (isVip: boolean) =>
      isVip
        ? simple("mission_vip", "Misión VIP: 5 clutches")
        : simple("mission", "Misión: 3 victorias en la semana"),
    firstStep: () => simple("first_steps", "Primeros pasos: votar un clip"),
    featuredClip: () => simple("clip_featured", "Clip destacado por un admin"),
    nextDay: () => setDayOffset((d) => d + 1),
    grant,
    updateItem,
    adminAccount,
    reset,
  }
}

export { SOURCE_LABEL }
