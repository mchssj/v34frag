import { queryOptions } from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"

// Datos públicos (sin sesión) de la landing y las tarjetas laterales del auth.

export type MatchSummary = Schemas["MatchSummary"]
export type EventSummary = Schemas["EventSummary"]
export type PlayerSummary = Schemas["PlayerSummary"]

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

export type ServerStatus = Schemas["ServerStatusItem"]
type ServerMode = NonNullable<ServerStatus["mode"]>

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

export const SERVER_MODE: Record<ServerMode, string> = {
  mix: "Mix",
  competitive: "Competitivo",
  public: "Público",
  deathmatch: "Deathmatch",
  retakes: "Retakes",
  practice: "Práctica",
}

/** Servidor para el `connect` del `!claim`: uno de mix en línea; si no hay, cualquiera en línea. */
export function claimServer(servers: ServerStatus[]): ServerStatus | null {
  const reachable = servers.filter((s) => s.online && s.address)
  return reachable.find((s) => s.mode === "mix") ?? reachable[0] ?? null
}

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
