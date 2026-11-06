import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { isApiError } from "@/api/errors"
import { toMatchesQuery, type PlayerSearch } from "../lib/search"

// Todas las rutas aceptan el nick o el id (contrato 5). La clave usa el nick en minúsculas.
const k = (nick: string) => nick.toLowerCase()
const MINUTE = 60_000
const path = (id: string) => ({ path: { id } })

export const playerKeys = {
  all: (nick: string) => ["public-player", k(nick)] as const,
  detail: (nick: string) => ["public-player", k(nick), "detail"] as const,
  elo: (nick: string, per: number) =>
    ["public-player", k(nick), "elo", per] as const,
  recent: (nick: string) => ["public-player", k(nick), "recent"] as const,
  matches: (nick: string, s: PlayerSearch) =>
    ["public-player", k(nick), "matches", toMatchesQuery(s)] as const,
  maps: (nick: string) => ["public-player", k(nick), "maps"] as const,
  medals: (nick: string) => ["public-player", k(nick), "medals"] as const,
  medalList: (nick: string) =>
    ["public-player", k(nick), "medals", "list"] as const,
  medalProgress: (nick: string) =>
    ["public-player", k(nick), "medals", "progress"] as const,
  adjustments: (nick: string) =>
    ["public-player", k(nick), "adjustments"] as const,
  teams: (nick: string) => ["public-player", k(nick), "teams"] as const,
  seasons: (nick: string) => ["public-player", k(nick), "seasons"] as const,
  titles: (nick: string) => ["public-player", k(nick), "titles"] as const,
  // Por id: la ruta de los destacados no acepta el nick (replanteo 76).
  featured: (id: string) => ["public-player", "featured", id] as const,
}

export function playerOptions(nick: string) {
  return queryOptions({
    queryKey: playerKeys.detail(nick),
    queryFn: ({ signal }) =>
      unwrap(api.GET("/api/v1/players/{id}", { params: path(nick), signal })),
    staleTime: MINUTE,
    // 404 = no existe ese nick: no tiene sentido reintentar.
    retry: (failures, e) => failures < 2 && !isApiError(e, "NOT_FOUND"),
  })
}

/** Historial de ELO, del más viejo al más nuevo (la API lo manda al revés). */
export function eloHistoryOptions(nick: string, per: number) {
  return queryOptions({
    queryKey: playerKeys.elo(nick, per),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/players/{id}/elo-history", {
            params: { ...path(nick), query: { per } },
            signal,
          })
        )
      ).items
        .slice()
        .reverse(),
    placeholderData: keepPreviousData,
    staleTime: MINUTE,
  })
}

export function recentMatchesOptions(nick: string) {
  return queryOptions({
    queryKey: playerKeys.recent(nick),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/players/{id}/matches", {
            params: { ...path(nick), query: { per: 6 } },
            signal,
          })
        )
      ).items,
    staleTime: MINUTE,
  })
}

export function playerMatchesOptions(nick: string, search: PlayerSearch) {
  return queryOptions({
    queryKey: playerKeys.matches(nick, search),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/players/{id}/matches", {
          params: { ...path(nick), query: toMatchesQuery(search) },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
    staleTime: MINUTE,
  })
}

export function mapStatsOptions(nick: string) {
  return queryOptions({
    queryKey: playerKeys.maps(nick),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/players/{id}/map-stats", {
            params: {
              ...path(nick),
              query: { per: 100, sort: "maps", order: "desc" },
            },
            signal,
          })
        )
      ).items,
    staleTime: 5 * MINUTE,
  })
}

export function medalsOptions(nick: string) {
  return queryOptions({
    queryKey: playerKeys.medals(nick),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/players/{id}/medals/summary", {
            params: { ...path(nick), query: { per: 50 } },
            signal,
          })
        )
      ).items,
    staleTime: 5 * MINUTE,
  })
}

/** Todas sus medallas, con el dibujo (replanteo 79), para Logros. */
export function medalListOptions(nick: string) {
  return queryOptions({
    queryKey: playerKeys.medalList(nick),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/players/{id}/medals", {
            params: { ...path(nick), query: { per: 100 } },
            signal,
          })
        )
      ).items,
    staleTime: 5 * MINUTE,
  })
}

/** Cada medalla activa con su progreso (las bloqueadas de Logros). */
export function medalProgressOptions(nick: string) {
  return queryOptions({
    queryKey: playerKeys.medalProgress(nick),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/players/{id}/medals/progress", {
          params: path(nick),
          signal,
        })
      ),
    staleTime: 5 * MINUTE,
  })
}

export function adjustmentsOptions(nick: string) {
  return queryOptions({
    queryKey: playerKeys.adjustments(nick),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/players/{id}/elo-adjustments", {
            params: { ...path(nick), query: { per: 20 } },
            signal,
          })
        )
      ).items,
    staleTime: 5 * MINUTE,
  })
}

export function teamsOptions(nick: string) {
  return queryOptions({
    queryKey: playerKeys.teams(nick),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/players/{id}/teams", {
            params: { ...path(nick), query: { per: 50 } },
            signal,
          })
        )
      ).items,
    staleTime: 5 * MINUTE,
  })
}

export function seasonsOptions(nick: string) {
  return queryOptions({
    queryKey: playerKeys.seasons(nick),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/players/{id}/seasons", {
            params: { ...path(nick), query: { per: 50 } },
            signal,
          })
        )
      ).items,
    staleTime: 5 * MINUTE,
  })
}

export function titlesOptions(nick: string) {
  return queryOptions({
    queryKey: playerKeys.titles(nick),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/players/{id}/titles", {
            params: { ...path(nick), query: { per: 50 } },
            signal,
          })
        )
      ).items,
    staleTime: 5 * MINUTE,
  })
}

/** Los clips destacados de la ficha (elegidos o, en automático, los mejores), en orden. */
export function featuredClipsOptions(playerId: string) {
  return queryOptions({
    queryKey: playerKeys.featured(playerId),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/players/{id}/clips/featured", {
            params: path(playerId),
            signal,
          })
        )
      ).items,
    staleTime: MINUTE,
  })
}
