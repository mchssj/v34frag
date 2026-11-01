import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"

// Torneos: listado y detalle (handoff_torneos). Ver la bitácora 2026-10-25-torneos para lo que el
// backend todavía no tiene.

// En los esquemas generados, los `allOf` nulables (`champion`, `side.team`) quedan como
// `TeamRef & Record<string, never>`, y la respuesta de openapi-fetch los da como no nulos. Los datos
// reales traen null: se corrigen acá.
type TeamRef = Schemas["TeamRef"]
type Side = Omit<Schemas["MatchSide"], "team"> & { team: TeamRef | null }
export type EventSummary = Omit<Schemas["EventSummary"], "champion"> & {
  champion: TeamRef | null
}
export type EventDetail = Omit<Schemas["EventDetail"], "champion"> & {
  champion: TeamRef | null
}
export type EventMatch = Omit<Schemas["EventMatch"], "side1" | "side2"> & {
  side1: Side
  side2: Side
}
export type Registration = Schemas["Registration"]
export type LiveMatch = NonNullable<Schemas["LiveMatch"]>
export type Standing = Schemas["Standing"]

const MINUTE = 60_000

export const eventKeys = {
  list: ["events"] as const,
  // La comparte el breadcrumb del shell (features/shell/queries.ts).
  detail: (id: string) => ["event", id] as const,
  registrations: (id: string) => ["event", id, "registrations"] as const,
  matches: (id: string) => ["event", id, "matches"] as const,
  standings: (id: string) => ["event", id, "standings"] as const,
}

/** Todos los torneos (hasta 100); el filtro por estado se aplica en el cliente. */
export const eventListOptions = queryOptions({
  queryKey: eventKeys.list,
  queryFn: async ({ signal }): Promise<EventSummary[]> =>
    (
      await unwrap(
        api.GET("/api/v1/events", { params: { query: { per: 100 } }, signal })
      )
    ).items,
  staleTime: MINUTE,
})

export function eventDetailOptions(id: string) {
  return queryOptions({
    queryKey: eventKeys.detail(id),
    queryFn: ({ signal }): Promise<EventDetail> =>
      unwrap(
        api.GET("/api/v1/events/{id}", { params: { path: { id } }, signal })
      ),
    staleTime: MINUTE,
  })
}

/** Inscritos por orden de siembra. */
export function eventRegistrationsOptions(id: string) {
  return queryOptions({
    queryKey: eventKeys.registrations(id),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/events/{id}/registrations", {
            params: { path: { id }, query: { per: 100 } },
            signal,
          })
        )
      ).items.toSorted((a, b) => a.seed - b.seed),
    staleTime: MINUTE,
  })
}

/** Partidas en el orden de la llave (fase, etapa, grupo, ronda y posición), sin los libres. */
export function eventMatchesOptions(id: string) {
  return queryOptions({
    queryKey: eventKeys.matches(id),
    queryFn: async ({ signal }): Promise<EventMatch[]> =>
      (
        await unwrap(
          api.GET("/api/v1/events/{id}/matches", {
            params: { path: { id }, query: { per: 200 } },
            signal,
          })
        )
      ).items,
    staleTime: MINUTE,
    refetchInterval: MINUTE,
  })
}

export function eventStandingsOptions(id: string) {
  return queryOptions({
    queryKey: eventKeys.standings(id),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/events/{id}/standings", {
            params: { path: { id }, query: { per: 200 } },
            signal,
          })
        )
      ).items,
    staleTime: MINUTE,
  })
}

type RegistrationVars = { eventId: string; teamId: string }

/** Inscribir o cambiar los inscritos (líder u organizador, hasta que se arma el fixture). */
export function useRegisterTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      eventId,
      teamId,
      active,
      subs,
    }: RegistrationVars & { active: string[]; subs: string[] }) =>
      unwrap(
        api.PUT("/api/v1/events/{id}/registrations/{teamId}", {
          params: { path: { id: eventId, teamId } },
          body: { active, subs },
        })
      ),
    onSettled: (_d, _e, { eventId }) => invalidate(qc, eventId),
  })
}

export function useUnregisterTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, teamId }: RegistrationVars) =>
      unwrap(
        api.DELETE("/api/v1/events/{id}/registrations/{teamId}", {
          params: { path: { id: eventId, teamId } },
        })
      ),
    onSettled: (_d, _e, { eventId }) => invalidate(qc, eventId),
  })
}

// El detalle (conteo de inscritos y sorteo), los inscritos y el listado cambian con cada inscripción.
function invalidate(qc: ReturnType<typeof useQueryClient>, eventId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["event", eventId] }),
    qc.invalidateQueries({ queryKey: eventKeys.list }),
  ])
}
