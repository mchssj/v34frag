import { queryOptions } from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"

// Datos públicos (sin sesión) de la landing y las tarjetas laterales del auth.

export type MatchSummary = Schemas["MatchSummary"]
export type EventSummary = Schemas["EventSummary"]
export type PlayerSummary = Schemas["PlayerSummary"]

const MINUTE = 60_000

export const publicKeys = {
  liveCount: ["public", "live-count"] as const,
  featuredLive: ["public", "featured-live"] as const,
  mixesTotal: ["public", "mixes-total"] as const,
  nextEvent: ["public", "next-event"] as const,
  topPlayers: ["public", "top-players"] as const,
}

export const liveCountOptions = queryOptions({
  queryKey: publicKeys.liveCount,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/matches", {
          params: { query: { status: "live", per: 1 } },
          signal,
        })
      )
    ).total,
  staleTime: MINUTE,
  refetchInterval: MINUTE,
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

const numberFormat = new Intl.NumberFormat("es-AR")
export const formatNumber = (n: number) => numberFormat.format(n)

/** Copy de mixes reportados: "Más de 1.800" redondeando a centenas, o el número exacto si es chico. */
export function mixesCopy(total: number): { title: string; subtitle: string } {
  const amount =
    total > 100
      ? `Más de ${formatNumber(Math.floor((total - 1) / 100) * 100)}`
      : formatNumber(total)
  return {
    title: `${amount} mixes reportados por el servidor.`,
    subtitle: "Cada uno suma al ELO de quienes jugaron.",
  }
}

/** Nombre de un bando: el equipo si lo hay, si no el nombre del bando. */
// Tipo estructural: el generado para `team` es un allOf nullable difícil de usar.
export function sideName(side: {
  name: string | null
  team: { name: string } | null
}): string {
  return side.team?.name ?? side.name ?? "Por definir"
}
