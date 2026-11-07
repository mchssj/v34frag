import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { eventKeys } from "@/features/events/api/queries"
import type { EventStatus } from "../lib/model"

export const ADMIN_EVENTS_PER = 20

export const adminEventKeys = {
  all: ["admin", "events"] as const,
  list: (f: object) => ["admin", "events", "list", f] as const,
  candidates: (matchId: string) =>
    ["admin", "events", "candidates", matchId] as const,
  pendingGames: (f: object) => ["admin", "events", "pending-games", f] as const,
}

export type AdminEventFilters = {
  status?: EventStatus
  approval?: "pending" | "approved" | "rejected"
  historic?: boolean
  testing?: boolean
  pending_games?: boolean
  q?: string
  /** El organizador ve solo los suyos (id de usuario). */
  organizer?: string
  page: number
}

// Los filtros booleanos viajan como texto en la URL.
const flag = (v: boolean | undefined) =>
  v === undefined ? undefined : v ? ("true" as const) : ("false" as const)

export function adminEventsOptions(f: AdminEventFilters) {
  return queryOptions({
    queryKey: adminEventKeys.list(f),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/events", {
          params: {
            query: {
              status: f.status,
              approval: f.approval,
              historic: flag(f.historic),
              testing: flag(f.testing),
              pending_games: flag(f.pending_games),
              q: f.q || undefined,
              organizer: f.organizer,
              page: f.page,
              per: ADMIN_EVENTS_PER,
              sort: "starts_on",
              order: "desc",
            },
          },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })
}

export const gameModesOptions = queryOptions({
  queryKey: ["game-modes"] as const,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/game-modes", { signal })),
  staleTime: 10 * 60_000,
})

/** Mapas disponibles para el pool de un torneo. */
export const poolMapsOptions = queryOptions({
  queryKey: ["maps", "active"] as const,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/maps", { params: { query: { per: 100 } }, signal })
      )
    ).items,
  staleTime: 10 * 60_000,
})

export const serversOptions = queryOptions({
  queryKey: ["admin", "events", "servers"] as const,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/servers", { params: { query: { per: 100 } }, signal })
      )
    ).items,
  staleTime: 5 * 60_000,
})

export type CandidateFilters = {
  from?: string
  to?: string
  map?: string
  server?: string
  page?: number
}
export const CANDIDATES_PER = 20

/** Mixes para vincular a una partida (en un histórico, sin el límite de 14 días y con filtros). */
export function gameCandidatesOptions(
  matchId: string,
  f: CandidateFilters = {}
) {
  return queryOptions({
    queryKey: [...adminEventKeys.candidates(matchId), f] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/matches/{id}/games/candidates", {
          params: {
            path: { id: matchId },
            query: {
              from: f.from || undefined,
              to: f.to || undefined,
              map: f.map || undefined,
              server: f.server || undefined,
              page: f.page ?? 1,
              per: CANDIDATES_PER,
            },
          },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })
}

/** Mixes vinculados por un organizador que esperan aprobación (admin o moderador). */
export function pendingGamesOptions(f: { match?: string; page?: number }) {
  return queryOptions({
    queryKey: adminEventKeys.pendingGames(f),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/pending-games", {
          params: { query: { match: f.match, page: f.page ?? 1, per: 50 } },
          signal,
        })
      ),
  })
}

/** Equipos con un nombre parecido, antes de cargar uno histórico. */
export function similarTeamsOptions(eventId: string, q: string) {
  return queryOptions({
    queryKey: ["admin", "events", "similar", eventId, q] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/events/{id}/similar-teams", {
          params: { path: { id: eventId }, query: { q } },
          signal,
        })
      ),
    enabled: q.trim().length >= 2,
    placeholderData: keepPreviousData,
  })
}

/** Después de cualquier cambio de un torneo: su detalle, inscritos, partidas, tablas y la lista. */
function useInvalidateEvent() {
  const qc = useQueryClient()
  return (id: string) => {
    void qc.invalidateQueries({ queryKey: eventKeys.detail(id) })
    void qc.invalidateQueries({ queryKey: eventKeys.list })
    void qc.invalidateQueries({ queryKey: adminEventKeys.all })
  }
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Schemas["EventCreate"]) =>
      unwrap(api.POST("/api/v1/events", { body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminEventKeys.all })
      void qc.invalidateQueries({ queryKey: eventKeys.list })
    },
  })
}

export function useUpdateEvent(id: string) {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: (body: Schemas["EventPatch"]) =>
      unwrap(
        api.PATCH("/api/v1/events/{id}", { params: { path: { id } }, body })
      ),
    onSuccess: () => invalidate(id),
  })
}

/** Banner del torneo, ya recortado a 4:1 (quien gestiona el torneo). */
export function useUploadBanner(id: string) {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: (blob: Blob) => {
      const form = new FormData()
      form.append("file", blob, "banner.jpg")
      return unwrap(
        api.PUT("/api/v1/events/{id}/banner", {
          params: { path: { id } },
          // El schema tipa el archivo como string (binary): el multipart se arma a mano.
          body: { file: "" },
          bodySerializer: () => form,
        })
      )
    },
    onSuccess: () => invalidate(id),
  })
}

/** Quita el banner: vuelve el patrón por defecto. */
export function useRemoveBanner(id: string) {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: () =>
      unwrap(
        api.DELETE("/api/v1/events/{id}/banner", { params: { path: { id } } })
      ),
    onSuccess: () => invalidate(id),
  })
}

/** Acciones del torneo sin cuerpo: generar, reiniciar (volver a la siembra), cancelar, borrar. */
export function useEventAction(id: string) {
  const invalidate = useInvalidateEvent()
  const params = { params: { path: { id } } }
  return useMutation({
    mutationFn: (action: "generate" | "reset" | "cancel" | "delete") => {
      switch (action) {
        case "generate":
          return unwrap(api.POST("/api/v1/events/{id}/generate", params))
        case "reset":
          return unwrap(api.POST("/api/v1/events/{id}/reset", params))
        case "cancel":
          return unwrap(api.POST("/api/v1/events/{id}/cancel", params))
        case "delete":
          return unwrap(api.DELETE("/api/v1/events/{id}", params))
      }
    },
    onSuccess: () => invalidate(id),
  })
}

/** Siembra: por ranking, sorteada o a mano (la lista entera, del 1 en adelante). */
export function useSeeds(id: string) {
  const invalidate = useInvalidateEvent()
  const params = { params: { path: { id } } }
  return useMutation({
    mutationFn: async (
      arg:
        { by: "ranking" } | { by: "draw" } | { by: "manual"; teams: string[] }
    ) => {
      if (arg.by === "ranking")
        await unwrap(api.POST("/api/v1/events/{id}/seeds/ranking", params))
      else if (arg.by === "draw")
        await unwrap(api.POST("/api/v1/events/{id}/draw", params))
      else
        await unwrap(
          api.PUT("/api/v1/events/{id}/seeds", {
            ...params,
            body: { teams: arg.teams },
          })
        )
    },
    onSuccess: () => invalidate(id),
  })
}

export function useRemoveRegistration(eventId: string) {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: (teamId: string) =>
      unwrap(
        api.DELETE("/api/v1/events/{id}/registrations/{teamId}", {
          params: { path: { id: eventId, teamId } },
        })
      ),
    onSuccess: () => invalidate(eventId),
  })
}

/** Horario y servidor de una partida (a mano: no hay horarios automáticos). */
export function useScheduleMatch(eventId: string) {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: ({
      matchId,
      ...body
    }: { matchId: string } & Schemas["ScheduleBody"]) =>
      unwrap(
        api.PATCH("/api/v1/matches/{id}", {
          params: { path: { id: matchId } },
          body,
        })
      ),
    onSuccess: () => invalidate(eventId),
  })
}

/** Mapas de una serie: cada uno con un mix vinculado o el resultado a mano. */
export function useSeriesMaps(eventId: string) {
  const invalidate = useInvalidateEvent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      matchId,
      maps,
    }: {
      matchId: string
      maps: Schemas["SeriesMap"][]
    }) =>
      unwrap(
        api.PUT("/api/v1/matches/{id}/maps", {
          params: { path: { id: matchId } },
          body: { maps },
        })
      ),
    onSuccess: (_, { matchId }) => {
      invalidate(eventId)
      void qc.invalidateQueries({ queryKey: ["match", matchId] })
      void qc.invalidateQueries({
        queryKey: adminEventKeys.candidates(matchId),
      })
    },
  })
}

/** W.O. o anular el resultado (POST /matches/{id}/result). */
export function useMatchResult(eventId: string) {
  const invalidate = useInvalidateEvent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      matchId,
      ...body
    }: { matchId: string } & Schemas["ResultBody"]) =>
      unwrap(
        api.POST("/api/v1/matches/{id}/result", {
          params: { path: { id: matchId } },
          body,
        })
      ),
    onSuccess: (_, { matchId }) => {
      invalidate(eventId)
      void qc.invalidateQueries({ queryKey: ["match", matchId] })
    },
  })
}

/** Aprobar o rechazar un torneo pendiente (admin o moderador). */
export function useReviewEvent(id: string) {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: (body: Schemas["ReviewBody"]) =>
      unwrap(
        api.POST("/api/v1/events/{id}/review", {
          params: { path: { id } },
          body,
        })
      ),
    onSuccess: () => invalidate(id),
  })
}

/** El organizador vuelve a enviar un torneo rechazado. */
export function useResubmitEvent(id: string) {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/v1/events/{id}/resubmit", { params: { path: { id } } })
      ),
    onSuccess: () => invalidate(id),
  })
}

/** Inscribir (o cambiar los jugadores de) un equipo: en un histórico, de 0 a 10 fichas cualesquiera. */
export function useRegisterTeam(eventId: string) {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: ({ teamId, players }: { teamId: string; players: string[] }) =>
      unwrap(
        api.PUT("/api/v1/events/{id}/registrations/{teamId}", {
          params: { path: { id: eventId, teamId } },
          body: { active: players, subs: [] },
        })
      ),
    onSuccess: () => invalidate(eventId),
  })
}

/** Cargar un equipo que no está en la plataforma (torneo histórico). */
export function useCreateHistoricTeam(eventId: string) {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: (body: Schemas["HistoricTeamBody"]) =>
      unwrap(
        api.POST("/api/v1/events/{id}/historic-teams", {
          params: { path: { id: eventId } },
          body,
        })
      ),
    onSuccess: () => invalidate(eventId),
  })
}

/** Corregir el nombre y la sigla de un equipo histórico. */
export function useUpdateHistoricTeam(eventId: string) {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: ({
      teamId,
      ...body
    }: { teamId: string } & Schemas["HistoricTeamBody"]) =>
      unwrap(
        api.PATCH("/api/v1/historic-teams/{id}", {
          params: { path: { id: teamId } },
          body,
        })
      ),
    onSuccess: () => invalidate(eventId),
  })
}

/** Aprobar o rechazar un mix vinculado (admin o moderador). Rechazado, queda el marcador a mano. */
export function useReviewGame(eventId: string) {
  const invalidate = useInvalidateEvent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      matchId,
      gameId,
      approve,
    }: {
      matchId: string
      gameId: string
      approve: boolean
    }) =>
      unwrap(
        api.POST("/api/v1/matches/{id}/games/{gameId}/review", {
          params: { path: { id: matchId, gameId } },
          body: { approve },
        })
      ),
    onSuccess: (_, { matchId }) => {
      invalidate(eventId)
      void qc.invalidateQueries({ queryKey: ["match", matchId] })
    },
  })
}
