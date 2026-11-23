import type { Schemas } from "@/api/client"

// El tablero del editor: los tiers con sus ítems y el banco, sin React. Se arma desde la tierlist de la API y se
// convierte en el cuerpo de PUT /tierlists/{id}. Los topes los vuelve a aplicar la base (replanteo 137).

export const MAX_TIERS = 10
export const MAX_ITEMS = 100
export const NAME_MAX = 40
export const BANK = "bank"

type ApiItem = Schemas["TierlistItem"]
export type Entry = ApiItem & { key: string }
export type Tier = { key: string; label: string; items: Entry[] }
export type Board = { name: string; tiers: Tier[]; bank: Entry[] }

let seq = 0
const newKey = (p: string) => `${p}${++seq}`

/** La clave de un ítem: la ficha o el equipo no se repiten; los externos sí pueden. */
export const entryKey = (i: ApiItem) =>
  i.kind === "player"
    ? `p:${i.id}`
    : i.kind === "team"
      ? `t:${i.id}`
      : newKey("x:")

const entry = (i: ApiItem): Entry => ({ ...i, key: entryKey(i) })

export function fromTierlist(t: Schemas["Tierlist"]): Board {
  return {
    name: t.name,
    tiers: t.tiers.map((r) => ({
      key: newKey("tier:"),
      label: r.label,
      items: r.items.map(entry),
    })),
    bank: t.bank.map(entry),
  }
}

export function toSave(b: Board): Schemas["TierlistSave"] {
  const item = (e: Entry): Schemas["TierlistSaveItem"] =>
    e.kind === "player"
      ? { player: e.id! }
      : e.kind === "team"
        ? { team: e.id! }
        : { name: e.name }
  return {
    name: b.name.trim(),
    tiers: b.tiers.map((t) => ({
      label: t.label.trim(),
      items: t.items.map(item),
    })),
    bank: b.bank.map(item),
  }
}

export const countItems = (b: Board) =>
  b.bank.length + b.tiers.reduce((n, t) => n + t.items.length, 0)

export const hasEntry = (b: Board, key: string) =>
  b.bank.some((e) => e.key === key) ||
  b.tiers.some((t) => t.items.some((e) => e.key === key))

/** Suma al banco (al final). No repite fichas ni equipos y respeta el tope. */
export function addItem(b: Board, item: ApiItem): Board {
  if (countItems(b) >= MAX_ITEMS) return b
  const e = entry(item)
  if (hasEntry(b, e.key)) return b
  return { ...b, bank: [...b.bank, e] }
}

const strip = (b: Board, key: string): [Board, Entry | undefined] => {
  let found: Entry | undefined
  const out = (list: Entry[]) =>
    list.filter((e) => (e.key === key ? ((found = e), false) : true))
  const next = {
    ...b,
    bank: out(b.bank),
    tiers: b.tiers.map((t) => ({ ...t, items: out(t.items) })),
  }
  return [next, found]
}

export const removeItem = (b: Board, key: string) => strip(b, key)[0]

/** Dónde está un ítem: el tier (o el banco) y su lugar. */
export function locate(b: Board, key: string) {
  const i = b.bank.findIndex((e) => e.key === key)
  if (i >= 0) return { container: BANK, index: i }
  for (const t of b.tiers) {
    const j = t.items.findIndex((e) => e.key === key)
    if (j >= 0) return { container: t.key, index: j }
  }
  return null
}

/** Mueve un ítem a un tier (o al banco), en `index` o al final. */
export function moveItem(
  b: Board,
  key: string,
  container: string,
  index?: number
): Board {
  const from = locate(b, key)
  const [rest, e] = strip(b, key)
  if (!e || !from) return b
  // Al mover dentro del mismo lugar hacia adelante, el hueco que deja corre el índice uno.
  const at = (len: number) => {
    let i = index ?? len
    if (
      from.container === container &&
      index !== undefined &&
      from.index < index
    )
      i -= 1
    return Math.max(0, Math.min(i, len))
  }
  const insert = (list: Entry[]) => {
    const l = [...list]
    l.splice(at(l.length), 0, e)
    return l
  }
  if (container === BANK) return { ...rest, bank: insert(rest.bank) }
  if (!rest.tiers.some((t) => t.key === container)) return b
  return {
    ...rest,
    tiers: rest.tiers.map((t) =>
      t.key === container ? { ...t, items: insert(t.items) } : t
    ),
  }
}

/** Corre un ítem un lugar a la izquierda (-1) o a la derecha (1) dentro de su tier. */
export function shiftItem(b: Board, key: string, by: -1 | 1): Board {
  const at = locate(b, key)
  if (!at) return b
  const target = at.index + by
  if (target < 0) return b
  return moveItem(b, key, at.container, by === 1 ? target + 1 : target)
}

export function addTier(b: Board, label = "Nuevo"): Board {
  if (b.tiers.length >= MAX_TIERS) return b
  return {
    ...b,
    tiers: [...b.tiers, { key: newKey("tier:"), label, items: [] }],
  }
}

/** Borra un tier: sus ítems vuelven al banco. Siempre queda al menos uno. */
export function removeTier(b: Board, key: string): Board {
  const t = b.tiers.find((x) => x.key === key)
  if (!t || b.tiers.length <= 1) return b
  return {
    ...b,
    tiers: b.tiers.filter((x) => x.key !== key),
    bank: [...b.bank, ...t.items],
  }
}

export const renameTier = (b: Board, key: string, label: string): Board => ({
  ...b,
  tiers: b.tiers.map((t) =>
    t.key === key ? { ...t, label: label.slice(0, NAME_MAX) } : t
  ),
})

export function shiftTier(b: Board, key: string, by: -1 | 1): Board {
  const i = b.tiers.findIndex((t) => t.key === key)
  const j = i + by
  if (i < 0 || j < 0 || j >= b.tiers.length) return b
  const tiers = [...b.tiers]
  ;[tiers[i], tiers[j]] = [tiers[j]!, tiers[i]!]
  return { ...b, tiers }
}

/** El primer problema que no deja guardar, o null. */
export function boardError(b: Board): string | null {
  if (!b.name.trim()) return "Ponle un nombre a la tierlist."
  if (b.tiers.some((t) => !t.label.trim()))
    return "Todos los tiers necesitan un nombre."
  if (countItems(b) > MAX_ITEMS) return `Hasta ${MAX_ITEMS} ítems.`
  return null
}

/** Color de cada tier por su lugar: de rojo (S) a violeta, como en las tierlists de siempre. */
export const TIER_COLORS = [
  "#ff7f7f",
  "#ffbf7f",
  "#ffdf7f",
  "#ffff7f",
  "#bfff7f",
  "#7fff7f",
  "#7fffff",
  "#7fbfff",
  "#7f7fff",
  "#ff7fff",
]
export const tierColor = (i: number) => TIER_COLORS[i % TIER_COLORS.length]!
