import { z } from "zod"

// Estado del perfil público en la URL (handoff_perfil_publico, "Estado"). Un valor inválido vuelve
// al de por defecto.

export const TABS = [
  "resumen",
  "mapas",
  "partidas",
  "equipos",
  "temporadas",
  "bio",
] as const
export type Tab = (typeof TABS)[number]

export const RANGES = [10, 20, 30] as const
export const PER_OPTIONS = [25, 50, 100] as const
export const DEFAULT_PER = 25

export const playerSearchSchema = z.object({
  tab: z.enum(TABS).optional().catch(undefined),
  range: z
    .union([z.literal(10), z.literal(20), z.literal(30)])
    .optional()
    .catch(undefined),
  kind: z.enum(["mix", "pcw", "official"]).optional().catch(undefined),
  result: z.enum(["won", "lost"]).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
  per: z
    .union([z.literal(25), z.literal(50), z.literal(100)])
    .optional()
    .catch(undefined),
})
export type PlayerSearch = z.infer<typeof playerSearchSchema>

/** `GET /api/v1/players/{id}/matches` de la pestaña Partidas. */
export function toMatchesQuery(s: PlayerSearch) {
  return {
    page: s.page ?? 1,
    per: s.per ?? DEFAULT_PER,
    ...(s.kind ? { kind: s.kind } : {}),
    ...(s.result ? { result: s.result } : {}),
  }
}
