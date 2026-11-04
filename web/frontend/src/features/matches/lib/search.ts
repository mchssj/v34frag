import { z } from "zod"

// Estado del listado /matches en la URL: tipo, búsqueda, mapa, página y tamaño. Un valor inválido
// vuelve al de por defecto en lugar de romper la página.

export const KINDS = ["mix", "pcw", "official"] as const
export type MatchKind = (typeof KINDS)[number]

export const PER_OPTIONS = [10, 15, 25] as const
export const DEFAULT_PER = 15

export const matchesSearchSchema = z.object({
  kind: z.enum(KINDS).optional().catch(undefined),
  q: z.string().max(60).optional().catch(undefined),
  map: z.string().max(40).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
  per: z
    .union([z.literal(10), z.literal(15), z.literal(25)])
    .optional()
    .catch(undefined),
})

export type MatchesSearch = z.infer<typeof matchesSearchSchema>

// La base guarda el mapa sin el prefijo ("de_cache" → "cache"); el filtro "contiene" de la API
// compara contra eso.
const bareMap = (name: string) => name.replace(/^(de|cs)_/i, "")

/**
 * Parámetros de `GET /api/v1/matches`. Solo las jugadas: `status` acepta un valor y sin él vienen
 * también las programadas (pedido E14: varios estados, para sumar las canceladas).
 */
export function toMatchesQuery(s: MatchesSearch) {
  const q = s.q?.trim()
  return {
    page: s.page ?? 1,
    per: s.per ?? DEFAULT_PER,
    status: "finished" as const,
    sort: "played_at" as const,
    order: "desc" as const,
    ...(s.kind ? { kind: s.kind } : {}),
    ...(q ? { q } : {}),
    ...(s.map ? { map: bareMap(s.map) } : {}),
  }
}
