import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { isApiError } from "@/api/errors"
import {
  toPlayerRankingQuery,
  toStandingsQuery,
  toTeamRankingQuery,
  type PlayerRankingSearch,
  type TeamRankingSearch,
} from "./search"

export type RankingPlayer = Schemas["RankingPlayer"]
export type RankingTeam = Schemas["RankingItem"]
export type Season = Schemas["Season"]
export type SeasonStanding = Schemas["SeasonStanding"]
export type ComparePlayer = Schemas["ComparePlayer"]
export type Compare = Schemas["Compare"]

export const rankingKeys = {
  all: ["ranking"] as const,
  players: (s: PlayerRankingSearch) =>
    ["ranking", "players", toPlayerRankingQuery(s)] as const,
  podium: ["ranking", "players", "podium"] as const,
  seasons: ["ranking", "seasons"] as const,
  current: ["ranking", "seasons", "current"] as const,
  standings: (id: string, s: PlayerRankingSearch) =>
    ["ranking", "standings", id, toStandingsQuery(s)] as const,
  standingsPodium: (id: string) =>
    ["ranking", "standings", id, "podium"] as const,
  teams: (s: TeamRankingSearch) =>
    ["ranking", "teams", toTeamRankingQuery(s)] as const,
  teamsPodium: (pcw: boolean) => ["ranking", "teams", "podium", pcw] as const,
  compare: (a: string, b: string) => ["ranking", "compare", a, b] as const,
  playerSearch: (q: string) => ["ranking", "player-search", q] as const,
}

const MINUTE = 60_000

export function playerRankingOptions(search: PlayerRankingSearch) {
  return queryOptions({
    queryKey: rankingKeys.players(search),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/ranking/players", {
          params: { query: toPlayerRankingQuery(search) },
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

export function standingsOptions(id: string, search: PlayerRankingSearch) {
  return queryOptions({
    queryKey: rankingKeys.standings(id, search),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/seasons/{id}/standings", {
          params: { path: { id }, query: toStandingsQuery(search) },
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

export function compareOptions(a: string, b: string) {
  return queryOptions({
    queryKey: rankingKeys.compare(a, b),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/players/compare", {
          params: { query: { a, b } },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
    retry: (failures, e) =>
      failures < 2 &&
      !isApiError(e, "NOT_FOUND") &&
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
