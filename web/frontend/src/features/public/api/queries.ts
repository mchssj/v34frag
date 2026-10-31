import { queryOptions } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"

const MINUTE = 60_000

export const publicKeys = {
  live: ["public", "live"] as const,
  featuredLive: ["public", "featured-live"] as const,
  mixesTotal: ["public", "mixes-total"] as const,
  nextEvent: ["public", "next-event"] as const,
  topPlayers: ["public", "top-players"] as const,
}

/**
 * Partidas en vivo: una página de 1 trae el total y la destacada. Una sola consulta para la
 * landing, el badge del sidebar y la NowBar (cada uno toma su parte con `select`).
 */
export const liveMatchesOptions = queryOptions({
  queryKey: publicKeys.live,
  queryFn: ({ signal }) =>
    unwrap(
      api.GET("/api/v1/matches", {
        params: { query: { status: "live", per: 1 } },
        signal,
      })
    ),
  staleTime: MINUTE,
  refetchInterval: MINUTE,
})

export const liveCountOptions = queryOptions({
  ...liveMatchesOptions,
  select: (page) => page.total,
})

/** Partida oficial en vivo para la tarjeta del login (null si no hay). */
export const featuredLiveOptions = queryOptions({
  queryKey: publicKeys.featuredLive,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/matches", {
          params: { query: { status: "live", kind: "official", per: 1 } },
          signal,
        })
      )
    ).items[0] ?? null,
  staleTime: MINUTE,
})

export const mixesTotalOptions = queryOptions({
  queryKey: publicKeys.mixesTotal,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/matches", {
          params: { query: { kind: "mix", status: "finished", per: 1 } },
          signal,
        })
      )
    ).total,
  staleTime: 10 * MINUTE,
})

/** Próximo torneo con inscripción abierta (el que empieza antes). */
export const nextEventOptions = queryOptions({
  queryKey: publicKeys.nextEvent,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/events", {
          params: {
            query: {
              status: "registration",
              sort: "starts_on",
              order: "asc",
              per: 1,
            },
          },
          signal,
        })
      )
    ).items[0] ?? null,
  staleTime: 5 * MINUTE,
})

export const topPlayersOptions = queryOptions({
  queryKey: publicKeys.topPlayers,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/players", {
          params: { query: { sort: "elo", order: "desc", per: 5 } },
          signal,
        })
      )
    ).items,
  staleTime: 5 * MINUTE,
})

/**
 * Estado de los servidores (A2S desde el backend). Lo comparten el pill del hero, la sección
 * Servidores y el paso de Vinculación. El backend lo guarda 20 s, así que no conviene más seguido.
 */
export const serverStatusOptions = queryOptions({
  queryKey: ["public", "servers-status"] as const,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/servers/status", { signal })),
  staleTime: 20_000,
  refetchInterval: 30_000,
})
