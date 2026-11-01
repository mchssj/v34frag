import type { Schemas } from "@/api/client"

// Lógica de Administración › Torneos (bitácora 2026-11-01-admin-torneos). Funciones puras.

export type Template = Schemas["EventCreate"]["template"]
export type EventConfig = NonNullable<Schemas["EventCreate"]["config"]>
export type Bo = 1 | 3 | 5

export const TEMPLATE_LABEL: Record<Template, string> = {
  single: "Eliminación directa",
  double: "Doble eliminación",
  groups: "Grupos + playoffs",
  swiss: "Suizo",
  groups_double: "Grupos de doble eliminación",
}

export const TEMPLATE_HINT: Record<Template, string> = {
  single: "Pierde y queda afuera.",
  double: "Hay que perder dos veces.",
  groups: "Todos contra todos por grupo.",
  swiss: "Rivales con el mismo récord.",
  groups_double: "Cada grupo es una llave doble.",
}

export type EventStatus = Schemas["EventSummary"]["status"]
export const STATUS_LABEL: Record<EventStatus, string> = {
  registration: "Inscripciones",
  in_progress: "En curso",
  finished: "Terminado",
  cancelled: "Cancelado",
}

// ---- "Qué falta" en la lista ----

type SummaryLike = Pick<
  Schemas["EventSummary"],
  "status" | "teams" | "max_teams" | "progress" | "current_stage"
> & { champion: { name: string } | null }

/** El siguiente paso de un torneo, para la columna "Qué falta" de la lista. */
export function nextStep(e: SummaryLike): {
  text: string
  tone: "muted" | "warn" | "primary"
} {
  switch (e.status) {
    case "cancelled":
      return { text: "Cancelado", tone: "muted" }
    case "finished":
      return {
        text: e.champion ? `Campeón: ${e.champion.name}` : "Terminado",
        tone: "muted",
      }
    case "registration":
      if (e.teams < 2)
        return {
          text:
            e.teams === 0
              ? "Sin inscritos todavía"
              : "Falta al menos otro equipo",
          tone: "warn",
        }
      return {
        text: e.max_teams
          ? `${e.teams}/${e.max_teams} inscritos · por generar`
          : `${e.teams} inscritos · por generar`,
        tone: "primary",
      }
    case "in_progress": {
      const p = e.progress
      const left = p ? p.total - p.played : 0
      const stage = e.current_stage ? `${e.current_stage} · ` : ""
      return left > 0
        ? {
            text: `${stage}${left} ${left === 1 ? "partida pendiente" : "partidas pendientes"}`,
            tone: "warn",
          }
        : { text: `${stage}esperando la ronda siguiente`, tone: "muted" }
    }
  }
}

// ---- Suizo ----

export type SwissPreset = {
  key: string
  label: string
  stages: 1 | 2 | 3
  size: 8 | 16
  wins: 2 | 3
}

/** Presets como los Major (formato_suizo.txt) y dos cortos. */
export const SWISS_PRESETS: SwissPreset[] = [
  { key: "classic", label: "Major clásico · 24", stages: 2, size: 16, wins: 3 },
  {
    key: "expanded",
    label: "Major expandido · 32",
    stages: 3,
    size: 16,
    wins: 3,
  },
  { key: "one", label: "Una etapa · 16", stages: 1, size: 16, wins: 3 },
  { key: "short", label: "Corto · 8", stages: 1, size: 8, wins: 2 },
]

export const presetOf = (c: { stages: number; size: number; wins: number }) =>
  SWISS_PRESETS.find(
    (p) => p.stages === c.stages && p.size === c.size && p.wins === c.wins
  )?.key ?? "custom"

/** Equipos de un suizo: los de la etapa 1 y size/2 que entran directo a cada etapa siguiente. */
export const swissTeams = (stages: number, size: number) =>
  size + (stages - 1) * (size / 2)

/**
 * Partidas y rondas de una etapa suiza: se juega por récord hasta que cada equipo llega a `wins`
 * victorias o derrotas (16 a 3 victorias: 33 partidas en 5 rondas).
 */
export function swissMatches(size: number, wins: number) {
  let pools = new Map<string, number>([["0-0", size]])
  let total = 0
  let rounds = 0
  while ([...pools.values()].some((n) => n > 0) && rounds < 12) {
    const next = new Map<string, number>()
    rounds++
    for (const [rec, n] of pools) {
      const [w, l] = rec.split("-").map(Number)
      const m = Math.floor(n / 2)
      total += m
      for (const [x, y] of [
        [w + 1, l],
        [w, l + 1],
      ])
        if (x < wins && y < wins)
          next.set(`${x}-${y}`, (next.get(`${x}-${y}`) ?? 0) + m)
    }
    pools = next
  }
  return { total, rounds }
}

// ---- Siembra ----

export type SeedBlock = { label: string; from: number; to: number }

/**
 * Bloques de la siembra. En un suizo de varias etapas, los mejores entran a la etapa más avanzada
 * en bloques de size/2 (como el trigger events_seed_stages de la base); el resto juega la etapa 1.
 * En los demás formatos, un solo bloque.
 */
export function seedBlocks(
  template: Template,
  config: { stages?: number; size?: number },
  n: number
): SeedBlock[] {
  const stages = template === "swiss" ? (config.stages ?? 1) : 1
  if (stages <= 1 || n === 0) return [{ label: "", from: 1, to: n }]
  const half = (config.size ?? 16) / 2
  const out: SeedBlock[] = []
  for (let s = stages, from = 1; s >= 1 && from <= n; s--) {
    const to = s === 1 ? n : Math.min(n, from + half - 1)
    out.push({
      label: s === 1 ? "Juegan la etapa 1" : `Entran directo a la etapa ${s}`,
      from,
      to,
    })
    from = to + 1
  }
  return out
}

/** Orden clásico de una llave de eliminación: 1-8, 4-5, 2-7, 3-6… (event_seed_order de la base). */
export function seedOrder(size: number): number[] {
  let o = [1, 2]
  while (o.length < size) {
    const m = o.length * 2
    o = o.flatMap((x) => [x, m + 1 - x])
  }
  return o.slice(0, size)
}

export type Pair<T> = { a: T | null; b: T | null; sa: number; sb: number }

/** Primera ronda de una llave con byes: con menos equipos que la potencia de 2, el mejor pasa solo. */
export function koRound1<T>(teams: T[]): Pair<T>[] {
  const size = 2 ** Math.ceil(Math.log2(Math.max(teams.length, 2)))
  const o = seedOrder(size)
  const pairs: Pair<T>[] = []
  for (let i = 0; i < size; i += 2)
    pairs.push({
      a: teams[o[i] - 1] ?? null,
      b: teams[o[i + 1] - 1] ?? null,
      sa: o[i],
      sb: o[i + 1],
    })
  return pairs
}

/** Primera ronda de una etapa suiza: mitad de arriba contra mitad de abajo (1 contra n/2+1…). */
export function swissRound1<T>(teams: T[], firstSeed = 1): Pair<T>[] {
  const half = Math.floor(teams.length / 2)
  return Array.from({ length: half }, (_, k) => ({
    a: teams[k],
    b: teams[k + half],
    sa: firstSeed + k,
    sb: firstSeed + k + half,
  }))
}

/** Reparto en serpentina en grupos: 1 a g van de A en adelante, g+1 a 2g vuelven, y así. */
export function snakeGroups<T>(teams: T[], groups: number): T[][] {
  const out: T[][] = Array.from({ length: Math.max(groups, 1) }, () => [])
  teams.forEach((t, i) => {
    const row = Math.floor(i / groups)
    const col = i % groups
    out[row % 2 === 0 ? col : groups - 1 - col].push(t)
  })
  return out
}

/** Mueve un elemento de una lista a otra posición (arrastrar en la siembra). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length) return list
  const out = [...list]
  const [x] = out.splice(from, 1)
  out.splice(Math.min(to, out.length), 0, x)
  return out
}

// ---- Mapas de una serie ----

export type SeriesMapDraft =
  | {
      kind: "mix"
      game_id: string
      /** Bando del mix que fue el equipo 1. Sin dato, la API conserva el que ya tenía. */
      side1?: 1 | 2
      map: string | null
      r1: number
      r2: number
    }
  | { kind: "manual"; map: string; r1: number | null; r2: number | null }

/** Mapas ganados por cada lado (con el mapa de ventaja) y si la serie queda definida. */
export function seriesScore(
  maps: Pick<SeriesMapDraft, "r1" | "r2">[],
  bestOf: number,
  advantageSide: number | null = null
) {
  let w1 = advantageSide === 1 ? 1 : 0
  let w2 = advantageSide === 2 ? 1 : 0
  for (const m of maps) {
    if (m.r1 == null || m.r2 == null || m.r1 === m.r2) continue
    if (m.r1 > m.r2) w1++
    else w2++
  }
  const need = Math.floor(bestOf / 2) + 1
  return { w1, w2, decided: w1 >= need || w2 >= need }
}

/** Por qué no se pueden guardar los mapas, o null si están bien. */
export function mapsProblem(
  maps: SeriesMapDraft[],
  bestOf: number
): string | null {
  if (maps.length > bestOf) return `Hasta ${bestOf} mapas en un BO${bestOf}.`
  for (const [i, m] of maps.entries()) {
    if (m.kind === "manual") {
      if (m.r1 == null || m.r2 == null)
        return `Faltan las rondas del mapa ${i + 1}.`
      if (m.r1 < 0 || m.r2 < 0 || m.r1 > 99 || m.r2 > 99)
        return `Las rondas del mapa ${i + 1} van de 0 a 99.`
      if (m.r1 === m.r2)
        return `El mapa ${i + 1} no puede terminar empatado (se juega overtime).`
    }
  }
  const ids = maps.flatMap((m) => (m.kind === "mix" ? [m.game_id] : []))
  if (new Set(ids).size !== ids.length)
    return "El mismo mix no puede ser dos mapas."
  return null
}
