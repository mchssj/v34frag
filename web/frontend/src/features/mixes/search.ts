import { z } from "zod"

import { STATS_TABS } from "./stats"

// Estado del listado en la URL (handoff: q, map, mine, hideCancel, page, per). Un valor inválido
// vuelve al de por defecto en lugar de romper la página.

export const PER_OPTIONS = [10, 15, 25] as const

export const mixesSearchSchema = z.object({
  q: z.string().max(60).optional().catch(undefined),
  map: z.string().max(40).optional().catch(undefined),
  mine: z.boolean().optional().catch(undefined),
  hideCancel: z.boolean().optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
  per: z
    .union([z.literal(10), z.literal(15), z.literal(25)])
    .optional()
    .catch(undefined),
})

export type MixesSearch = z.infer<typeof mixesSearchSchema>

export const DEFAULT_PER = 15

/** Parámetros de `GET /api/v1/mixes` a partir de la URL. */
export function toMixesQuery(s: MixesSearch) {
  const q = s.q?.trim()
  return {
    page: s.page ?? 1,
    per: s.per ?? DEFAULT_PER,
    ...(q ? { q } : {}),
    ...(s.map ? { map: s.map } : {}),
    ...(s.mine ? { mine: "true" as const } : {}),
    ...(s.hideCancel ? { hide_cancelled: "true" as const } : {}),
  }
}

/** Sala del mix (/match/$id y /mixes/live/$uid): la pestaña de estadísticas. General no va en la URL. */
export const roomSearchSchema = z.object({
  stats: z.enum(STATS_TABS).optional().catch(undefined),
})
export type RoomSearch = z.infer<typeof roomSearchSchema>
