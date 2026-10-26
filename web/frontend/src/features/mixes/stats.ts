import type { RoomPlayer, RoomStatus } from "./room"

// Pestañas de estadísticas de la sala (plan docs/bitacora/2026-10-25-stats-partida, sección 4.2).
// Todo se calcula con lo que manda la API; un divisor 0 da null ("—").

export const STATS_TABS = ["general", "advanced", "entry", "clutch"] as const
export type StatsTab = (typeof STATS_TABS)[number]

export const STATS_TAB_LABEL: Record<StatsTab, string> = {
  general: "General",
  advanced: "Avanzado",
  entry: "Entrada",
  clutch: "Clutch",
}

/** int: entero · dec2: 2 decimales · pct: entero + "%" · signed: con signo y color · zero: 0 apagado. */
export type StatFormat = "int" | "dec2" | "pct" | "signed" | "zero"

export type StatColumn = {
  key: string
  label: string
  /** Ayuda de la cabecera (tooltip). */
  help?: string
  value: (p: RoomPlayer) => number | null
  format: StatFormat
  /** Donde menos es mejor (muertes): se marca el menor. */
  lowerBetter?: boolean
  /** Sin "mejor valor" (Δ ELO). */
  noBest?: boolean
  /** Columna en negrita siempre (Rating, Total). */
  strong?: boolean
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null)
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null)
const mk = (p: RoomPlayer) => p.k2 + p.k3 + p.k4 + p.k5
const entries = (p: RoomPlayer) => p.fk + p.fd
const clutch = (n: number) => (p: RoomPlayer) => p.clutches?.[n - 1] ?? null

const GENERAL: StatColumn[] = [
  { key: "k", label: "K", value: (p) => p.k, format: "int" },
  { key: "d", label: "D", value: (p) => p.d, format: "int", lowerBetter: true },
  { key: "a", label: "A", value: (p) => p.a, format: "int" },
  { key: "pm", label: "+/-", value: (p) => p.k - p.d, format: "signed" },
  {
    key: "kr",
    label: "K/R",
    help: "Kills por ronda",
    value: (p) => ratio(p.k, p.rounds),
    format: "dec2",
  },
  {
    key: "adr",
    label: "ADR",
    help: "Daño promedio por ronda",
    value: (p) => p.adr,
    format: "int",
  },
  { key: "hsk", label: "HS", value: (p) => p.hsKills, format: "int" },
  {
    key: "hs",
    label: "HS %",
    help: "Porcentaje de kills con headshot",
    value: (p) => p.hs,
    format: "pct",
  },
  {
    key: "k2",
    label: "2k",
    help: "Rondas en las que hizo 2 kills",
    value: (p) => p.k2,
    format: "zero",
  },
  {
    key: "k3",
    label: "3k",
    help: "Rondas en las que hizo 3 kills",
    value: (p) => p.k3,
    format: "zero",
  },
  {
    key: "k4",
    label: "4k",
    help: "Rondas en las que hizo 4 kills",
    value: (p) => p.k4,
    format: "zero",
  },
  {
    key: "k5",
    label: "5k",
    help: "Rondas en las que hizo 5 kills (ace)",
    value: (p) => p.k5,
    format: "zero",
  },
  {
    key: "rating",
    label: "Rating",
    value: (p) => p.rating,
    format: "dec2",
    strong: true,
  },
  {
    key: "delta",
    label: "Δ ELO",
    value: (p) => p.delta,
    format: "signed",
    noBest: true,
  },
]

const ADVANCED: StatColumn[] = [
  {
    key: "mk",
    label: "MK",
    help: "Rondas con 2 kills o más",
    value: mk,
    format: "int",
  },
  {
    key: "mkp",
    label: "MK %",
    help: "Qué porcentaje de sus rondas tuvo 2 kills o más",
    value: (p) => pct(mk(p), p.rounds),
    format: "pct",
  },
  {
    key: "rp",
    label: "RP",
    help: "Rondas jugadas",
    value: (p) => p.rounds,
    format: "int",
  },
  { key: "plants", label: "Plantadas", value: (p) => p.plants, format: "zero" },
  { key: "defuses", label: "Defuses", value: (p) => p.defuses, format: "zero" },
]

const ENTRY: StatColumn[] = [
  {
    key: "tries",
    label: "Intentos",
    help: "Veces que fue el primero de su equipo en pelear un duelo en la ronda",
    value: entries,
    format: "int",
  },
  { key: "fk", label: "Elim.", value: (p) => p.fk, format: "int" },
  {
    key: "fd",
    label: "Muertes",
    value: (p) => p.fd,
    format: "int",
    lowerBetter: true,
  },
  { key: "fdiff", label: "Dif.", value: (p) => p.fk - p.fd, format: "signed" },
  {
    key: "tryp",
    label: "% intentos",
    help: "En qué porcentaje de sus rondas abrió la pelea",
    value: (p) => pct(entries(p), p.rounds),
    format: "pct",
  },
  {
    key: "win",
    label: "% éxito",
    help: "De esos duelos, cuántos ganó",
    value: (p) => pct(p.fk, entries(p)),
    format: "pct",
  },
]

const CLUTCH: StatColumn[] = [
  ...[1, 2, 3, 4, 5].map((n): StatColumn => ({
    key: `c${n}`,
    label: `1v${n}`,
    help: `Rondas que ganó quedando solo contra ${n === 1 ? "1 rival" : `${n} rivales`}`,
    value: clutch(n),
    format: "zero",
  })),
  {
    key: "ctotal",
    label: "Total",
    value: (p) => (p.clutches ? p.clutches.reduce((s, x) => s + x, 0) : null),
    format: "zero",
    strong: true,
  },
]

const TABS: Record<StatsTab, StatColumn[]> = {
  general: GENERAL,
  advanced: ADVANCED,
  entry: ENTRY,
  clutch: CLUTCH,
}

/** Columnas de una pestaña. En vivo no hay Δ ELO. */
export function columnsFor(tab: StatsTab, status: RoomStatus): StatColumn[] {
  const cols = TABS[tab]
  return status === "live" ? cols.filter((c) => c.key !== "delta") : cols
}

/** El mejor valor de cada columna entre los dos bandos (null si no hay nada que marcar). */
export function bestValues(
  cols: StatColumn[],
  players: RoomPlayer[]
): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const c of cols) {
    const vals = players.map(c.value).filter((v): v is number => v !== null)
    if (c.noBest || vals.length === 0) {
      out[c.key] = null
      continue
    }
    const best = c.lowerBetter ? Math.min(...vals) : Math.max(...vals)
    // Si nadie hizo nada (todos 0), no se marca.
    out[c.key] = !c.lowerBetter && best === 0 ? null : best
  }
  return out
}

export type StatsSort = { key: string; dir: "desc" | "asc" } | null

/** Un clic ordena de mayor a menor, otro invierte y el tercero vuelve al orden por rating. */
export function nextSort(current: StatsSort, key: string): StatsSort {
  if (!current || current.key !== key) return { key, dir: "desc" }
  if (current.dir === "desc") return { key, dir: "asc" }
  return null
}

/** Ordena en el navegador (son hasta 7 filas por bando). Los null van al final. */
export function sortPlayers(
  players: RoomPlayer[],
  cols: StatColumn[],
  sort: StatsSort
): RoomPlayer[] {
  const col = sort && cols.find((c) => c.key === sort.key)
  if (!sort || !col) return players
  const sign = sort.dir === "desc" ? -1 : 1
  return [...players].sort((a, b) => {
    const va = col.value(a)
    const vb = col.value(b)
    if (va === null) return vb === null ? 0 : 1
    if (vb === null) return -1
    return (va - vb) * sign
  })
}
