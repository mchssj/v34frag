import { z } from "zod"

// Estado del listado /matches en la URL: tipo, búsqueda, mapa, favoritas, página y tamaño, más los filtros avanzados
// (VIP, bitácora 2026-11-24-exportar-stats-y-buscador-vip). Un valor inválido vuelve al de por defecto en lugar de romper
// la página.

export const KINDS = ["mix", "pcw", "official"] as const
export type MatchKind = (typeof KINDS)[number]

export const PER_OPTIONS = [10, 15, 25] as const
export const DEFAULT_PER = 15

/** Diferencia de rondas desde la que el filtro no hace nada. */
export const DIFF_MAX = 13

const nick = z.string().min(1).max(40).optional().catch(undefined)
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)

export const matchesSearchSchema = z.object({
  kind: z.enum(KINDS).optional().catch(undefined),
  q: z.string().max(60).optional().catch(undefined),
  map: z.string().max(40).optional().catch(undefined),
  fav: z.boolean().optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
  per: z
    .union([z.literal(10), z.literal(15), z.literal(25)])
    .optional()
    .catch(undefined),
  // Filtros avanzados (VIP).
  player: nick,
  with: nick,
  vs: nick,
  from: day,
  to: day,
  diff: z
    .number()
    .int()
    .min(0)
    .max(DIFF_MAX - 1)
    .optional()
    .catch(undefined),
  demo: z.boolean().optional().catch(undefined),
  sort: z.enum(["close", "mvp"]).optional().catch(undefined),
})

export type MatchesSearch = z.infer<typeof matchesSearchSchema>

/** Filtros que solo se aplican con VIP. */
type Advanced =
  "player" | "with" | "vs" | "from" | "to" | "diff" | "demo" | "sort"

// La base guarda el mapa sin el prefijo ("de_cache" → "cache"); el filtro "contiene" de la API
// compara contra eso.
const bareMap = (name: string) => name.replace(/^(de|cs)_/i, "")

const SORTS = {
  close: { sort: "round_diff", order: "asc" },
  mvp: { sort: "mvp_rating", order: "desc" },
} as const

/** El comienzo o el final de un día, en la hora de quien busca. */
const dayEdge = (d: string, end: boolean) =>
  new Date(`${d}T${end ? "23:59:59.999" : "00:00:00"}`).toISOString()

/**
 * Parámetros de `GET /api/v1/matches`. Solo las jugadas: `status` acepta un valor y sin él vienen
 * también las programadas (pedido E14: varios estados, para sumar las canceladas). Sin VIP, los filtros avanzados que
 * traiga la URL no se mandan (la API daría 403).
 */
export function toMatchesQuery(s: MatchesSearch, vip = false) {
  const q = s.q?.trim()
  return {
    page: s.page ?? 1,
    per: s.per ?? DEFAULT_PER,
    status: "finished" as const,
    ...(vip && s.sort
      ? SORTS[s.sort]
      : { sort: "played_at" as const, order: "desc" as const }),
    ...(s.kind ? { kind: s.kind } : {}),
    ...(q ? { q } : {}),
    ...(s.map ? { map: bareMap(s.map) } : {}),
    ...(s.fav ? { favorites: "true" as const } : {}),
    ...(vip
      ? {
          ...(s.player ? { player: s.player } : {}),
          // Con y contra son respecto del jugador.
          ...(s.player && s.with ? { with: s.with } : {}),
          ...(s.player && s.vs ? { against: s.vs } : {}),
          ...(s.from ? { from: dayEdge(s.from, false) } : {}),
          ...(s.to ? { to: dayEdge(s.to, true) } : {}),
          ...(s.diff !== undefined ? { max_diff: s.diff } : {}),
          ...(s.demo ? { demo: "true" as const } : {}),
        }
      : {}),
  }
}

/** Una píldora por filtro avanzado activo, con las claves que hay que borrar para sacarla. */
export function matchChips(s: MatchesSearch) {
  const chips: { label: string; clear: Advanced[] }[] = []
  const add = (label: string, ...clear: Advanced[]) =>
    chips.push({ label, clear })
  // Sin el jugador, con y contra no dicen nada: se van con él.
  if (s.player) add(`Jugó ${s.player}`, "player", "with", "vs")
  if (s.player && s.with) add(`Con ${s.with}`, "with")
  if (s.player && s.vs) add(`Contra ${s.vs}`, "vs")
  if (s.from) add(`Desde ${s.from}`, "from")
  if (s.to) add(`Hasta ${s.to}`, "to")
  if (s.diff !== undefined) add(`Diferencia de hasta ${s.diff}`, "diff")
  if (s.demo) add("Con demo", "demo")
  if (s.sort) add(s.sort === "close" ? "Las más parejas" : "Mejor MVP", "sort")
  return chips
}
