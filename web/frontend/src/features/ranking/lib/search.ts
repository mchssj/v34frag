import { z } from "zod"

import { savable } from "@/features/search/lib/search"
import { playerFilterShape, toFilterQuery } from "./filters"

// Estado de Ranking en la URL (handoff_ranking, "Estado", más temporada, orden y página). Un valor
// inválido vuelve al de por defecto en lugar de romper la página.

export const PER_OPTIONS = [25, 50, 100] as const
export const DEFAULT_PER = 25

const per = z
  .union([z.literal(25), z.literal(50), z.literal(100)])
  .optional()
  .catch(undefined)
const page = z.number().int().min(1).optional().catch(undefined)
const q = z.string().max(60).optional().catch(undefined)
const order = z.enum(["asc", "desc"]).optional().catch(undefined)

/** `season`: id de una temporada o `all` (Histórico). Sin el parámetro, la activa. */
export const HISTORIC = "all"

export const playerRankingSearchSchema = z.object({
  season: z.string().max(40).optional().catch(undefined),
  q,
  level: z.enum(["10", "7-9", "1-6"]).optional().catch(undefined),
  eligible: z.boolean().optional().catch(undefined),
  sort: z.enum(["rating", "kd", "matches", "elo"]).optional().catch(undefined),
  order,
  page,
  per,
  // Filtros avanzados (VIP).
  ...playerFilterShape,
})
export type PlayerRankingSearch = z.infer<typeof playerRankingSearchSchema>

export const teamRankingSearchSchema = z.object({
  q,
  pcw: z.boolean().optional().catch(undefined),
  page,
  per,
})
export type TeamRankingSearch = z.infer<typeof teamRankingSearchSchema>

const nick = z.string().max(40).optional().catch(undefined)
/** Los puestos del comparador: `a` y `b` para todos; `c`, `d` y `e`, con VIP. El color va con la letra. */
export const COMPARE_SLOTS = ["a", "b", "c", "d", "e"] as const
export type CompareSlot = (typeof COMPARE_SLOTS)[number]
export const compareSearchSchema = z.object({
  a: nick,
  b: nick,
  c: nick,
  d: nick,
  e: nick,
})
export type CompareSearch = z.infer<typeof compareSearchSchema>

const paging = (s: { page?: number; per?: number }) => ({
  page: s.page ?? 1,
  per: s.per ?? DEFAULT_PER,
})
const text = (v?: string) => {
  const t = v?.trim()
  return t ? { q: t } : {}
}

/** Búsquedas guardadas del ranking: todo menos la temporada, así se abren en la que se está mirando. */
export const savedRanking = {
  save: (s: PlayerRankingSearch) => savable({ ...s, season: undefined }),
  apply: (query: unknown): Partial<PlayerRankingSearch> => {
    // Reemplaza todo lo que había.
    const next = {
      ...Object.fromEntries(
        Object.keys(playerRankingSearchSchema.shape).map((k) => [k, undefined])
      ),
      ...playerRankingSearchSchema.parse(query),
    }
    delete next.season
    return next
  },
}

// Sin VIP, los filtros avanzados que traiga la URL no se mandan (la API daría 403).
const advanced = (s: PlayerRankingSearch, vip: boolean) =>
  vip ? toFilterQuery(s) : {}

/** `GET /api/v1/ranking/players` (Histórico). Sin orden propio va por posición. */
export function toPlayerRankingQuery(s: PlayerRankingSearch, vip = false) {
  const sort = s.sort === "elo" ? undefined : s.sort
  return {
    ...paging(s),
    ...text(s.q),
    ...(s.level ? { level: s.level } : {}),
    ...(sort ? { sort, order: s.order ?? ("desc" as const) } : {}),
    ...advanced(s, vip),
  }
}

/** `GET /api/v1/seasons/{id}/standings`. Sin orden propio va por puesto (los sin puesto al final). */
export function toStandingsQuery(s: PlayerRankingSearch, vip = false) {
  const sort = s.sort
  return {
    ...paging(s),
    ...text(s.q),
    ...(s.eligible ? { eligible: "true" as const } : {}),
    ...(s.level ? { level: s.level } : {}),
    ...(sort ? { sort, order: s.order ?? ("desc" as const) } : {}),
    ...advanced(s, vip),
  }
}

/** `GET /api/v1/ranking/teams`. */
export function toTeamRankingQuery(s: TeamRankingSearch) {
  return {
    ...paging(s),
    ...text(s.q),
    pcw: s.pcw ? ("1" as const) : ("0" as const),
  }
}
