import { z } from "zod"

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
})
export type PlayerRankingSearch = z.infer<typeof playerRankingSearchSchema>

export const teamRankingSearchSchema = z.object({
  q,
  pcw: z.boolean().optional().catch(undefined),
  page,
  per,
})
export type TeamRankingSearch = z.infer<typeof teamRankingSearchSchema>

export const compareSearchSchema = z.object({
  a: z.string().max(40).optional().catch(undefined),
  b: z.string().max(40).optional().catch(undefined),
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

/** `GET /api/v1/ranking/players` (Histórico). Sin orden propio va por posición. */
export function toPlayerRankingQuery(s: PlayerRankingSearch) {
  const sort = s.sort === "elo" ? undefined : s.sort
  return {
    ...paging(s),
    ...text(s.q),
    ...(s.level ? { level: s.level } : {}),
    ...(sort ? { sort, order: s.order ?? ("desc" as const) } : {}),
  }
}

/** `GET /api/v1/seasons/{id}/standings`. Sin orden propio va por puesto (los sin puesto al final). */
export function toStandingsQuery(s: PlayerRankingSearch) {
  const sort = s.sort
  return {
    ...paging(s),
    ...text(s.q),
    ...(s.eligible ? { eligible: "true" as const } : {}),
    ...(s.level ? { level: s.level } : {}),
    ...(sort ? { sort, order: s.order ?? ("desc" as const) } : {}),
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
