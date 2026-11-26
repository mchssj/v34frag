import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { isApiError } from "@/api/errors"
import {
  toPlayerRankingQuery,
  toStandingsQuery,
  toTeamRankingQuery,
  type PlayerRankingSearch,
  type TeamRankingSearch,
} from "../lib/search"

export const rankingKeys = {
  all: ["ranking"] as const,
  players: (s: PlayerRankingSearch, vip: boolean) =>
    ["ranking", "players", toPlayerRankingQuery(s, vip)] as const,
  podium: ["ranking", "players", "podium"] as const,
  seasons: ["ranking", "seasons"] as const,
  current: ["ranking", "seasons", "current"] as const,
  standings: (id: string, s: PlayerRankingSearch, vip: boolean) =>
    ["ranking", "standings", id, toStandingsQuery(s, vip)] as const,
  standingsPodium: (id: string) =>
    ["ranking", "standings", id, "podium"] as const,
  teams: (s: TeamRankingSearch) =>
    ["ranking", "teams", toTeamRankingQuery(s)] as const,
  teamsPodium: (pcw: boolean) => ["ranking", "teams", "podium", pcw] as const,
  compare: (nicks: string[]) => ["ranking", "compare", ...nicks] as const,
  playerSearch: (q: string) => ["ranking", "player-search", q] as const,
}

const MINUTE = 60_000

export function playerRankingOptions(
  search: PlayerRankingSearch,
  vip: boolean
) {
  return queryOptions({
    queryKey: rankingKeys.players(search, vip),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/ranking/players", {
          params: { query: toPlayerRankingQuery(search, vip) },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
    staleTime: MINUTE,
  })
}

// El podio son los 3 primeros sin filtros (contrato 5c): no cambia con el buscador ni con el nivel.
export const playerPodiumOptions = queryOptions({
  queryKey: rankingKeys.podium,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/ranking/players", {
          params: { query: { per: 3 } },
          signal,
        })
      )
    ).items,
  staleTime: MINUTE,
})

export const seasonsOptions = queryOptions({
  queryKey: rankingKeys.seasons,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/seasons", {
          params: { query: { per: 100 } },
          signal,
        })
      )
    ).items,
  staleTime: 5 * MINUTE,
})

/** La temporada activa, o null si no hay ninguna (404). */
export const currentSeasonOptions = queryOptions({
  queryKey: rankingKeys.current,
  queryFn: async ({ signal }) => {
    try {
      return await unwrap(api.GET("/api/v1/seasons/current", { signal }))
    } catch (e) {
      if (isApiError(e, "NOT_FOUND")) return null
      throw e
    }
  },
  staleTime: 5 * MINUTE,
})

export function standingsOptions(
  id: string,
  search: PlayerRankingSearch,
  vip: boolean
) {
  return queryOptions({
    queryKey: rankingKeys.standings(id, search, vip),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/seasons/{id}/standings", {
          params: { path: { id }, query: toStandingsQuery(search, vip) },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
    staleTime: MINUTE,
  })
}

/** Los 3 primeros con puesto de la temporada. */
export function standingsPodiumOptions(id: string) {
  return queryOptions({
    queryKey: rankingKeys.standingsPodium(id),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/seasons/{id}/standings", {
            params: { path: { id }, query: { per: 3, eligible: "true" } },
            signal,
          })
        )
      ).items,
    staleTime: MINUTE,
  })
}

export function teamRankingOptions(search: TeamRankingSearch) {
  return queryOptions({
    queryKey: rankingKeys.teams(search),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/ranking/teams", {
          params: { query: toTeamRankingQuery(search) },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
    staleTime: MINUTE,
  })
}

/** Los 3 primeros del modo (con o sin PCW), sin el buscador. */
export function teamPodiumOptions(pcw: boolean) {
  return queryOptions({
    queryKey: rankingKeys.teamsPodium(pcw),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/ranking/teams", {
            params: { query: { per: 3, pcw: pcw ? "1" : "0" } },
            signal,
          })
        )
      ).items,
    staleTime: MINUTE,
  })
}

/** De dos a cinco jugadores (más de dos, con VIP: la API da 403). */
export function compareOptions(nicks: string[]) {
  const [a = "", b = "", c, d, e] = nicks
  return queryOptions({
    queryKey: rankingKeys.compare(nicks),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/players/compare", {
          params: {
            query: {
              a,
              b,
              ...(c ? { c } : {}),
              ...(d ? { d } : {}),
              ...(e ? { e } : {}),
            },
          },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
    retry: (failures, e) =>
      failures < 2 &&
      !isApiError(e, "NOT_FOUND") &&
      // Sin VIP, más de dos.
      !isApiError(e, "FORBIDDEN") &&
      !isApiError(e, "VALIDATION_ERROR"),
  })
}

/** Búsqueda de fichas para el combobox del comparador (por ELO, las 8 primeras). */
export function playerSearchOptions(q: string) {
  return queryOptions({
    queryKey: rankingKeys.playerSearch(q),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/players", {
            params: {
              query: {
                per: 8,
                sort: "elo",
                order: "desc",
                ...(q ? { q } : {}),
              },
            },
            signal,
          })
        )
      ).items,
    placeholderData: keepPreviousData,
    staleTime: MINUTE,
  })
}

/** Estadísticas de toda la temporada (replanteo 129): públicas al cerrar; en vivo, solo para admins. */
export function seasonSummaryOptions(number: number) {
  return queryOptions({
    queryKey: ["season-summary", number] as const,
    queryFn: async ({ signal }) =>
      unwrap(
        api.GET("/api/v1/seasons/{number}/summary", {
          params: { path: { number } },
          signal,
        })
      ),
    staleTime: MINUTE,
    retry: false,
  })
}
