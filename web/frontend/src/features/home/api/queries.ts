import { queryOptions } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { MIXES_REFRESH_MS } from "@/features/mixes/api/queries"
import type { MatchSummary } from "@/features/matches/types"

const MINUTE = 60_000

export const homeKeys = {
  live: ["home", "live-matches"] as const,
  upcoming: ["home", "upcoming"] as const,
  events: ["home", "events"] as const,
  teams: ["home", "top-teams"] as const,
}

/** Partidas de torneo y PCW en vivo (los mixes salen de `liveMixesOptions`). */
export const liveMatchesOptions = queryOptions({
  queryKey: homeKeys.live,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/matches", {
          params: { query: { status: "live", per: 6 } },
          signal,
        })
      )
    ).items as MatchSummary[],
  refetchInterval: MIXES_REFRESH_MS,
})

/** Las próximas 4 partidas programadas, de la más cercana a la más lejana. */
export const upcomingMatchesOptions = queryOptions({
  queryKey: homeKeys.upcoming,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/matches", {
          params: {
            query: {
              status: "upcoming",
              sort: "starts_at",
              order: "asc",
              per: 4,
            },
          },
          signal,
        })
      )
    ).items as MatchSummary[],
  staleTime: MINUTE,
})

/** Torneos en curso y con inscripciones abiertas, en ese orden. */
export const activeEventsOptions = queryOptions({
  queryKey: homeKeys.events,
  queryFn: async ({ signal }) => {
    const get = (status: "in_progress" | "registration") =>
      unwrap(
        api.GET("/api/v1/events", {
          params: { query: { status, sort: "starts_on", per: 3 } },
          signal,
        })
      )
    const [live, open] = await Promise.all([
      get("in_progress"),
      get("registration"),
    ])
    return [...live.items, ...open.items].slice(0, 3)
  },
  staleTime: MINUTE,
})

/** Top 5 del ranking de equipos (puntos por partida de torneo ganada). */
export const topTeamsOptions = queryOptions({
  queryKey: homeKeys.teams,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/ranking/teams", {
          params: { query: { per: 5, pcw: "0" } },
          signal,
        })
      )
    ).items,
  staleTime: MINUTE,
})
