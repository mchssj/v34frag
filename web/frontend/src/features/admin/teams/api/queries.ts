import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"

export type TeamConfig = Schemas["TeamConfig"]
export type AdminTeam = Schemas["AdminTeamRow"]
export type TeamAuditEntry = Schemas["TeamAuditEntry"]
export type TeamFilter = "blocked" | "incomplete" | "no_leader" | "in_event"

export const ADMIN_TEAMS_PER = 20

export const adminTeamKeys = {
  all: ["admin", "teams"] as const,
  list: (f: object) => ["admin", "teams", "list", f] as const,
  history: (id: string) => ["admin", "teams", "history", id] as const,
}

export const teamConfigOptions = queryOptions({
  queryKey: ["admin", "teams", "config"] as const,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/admin/teams/config", { signal })),
})

export function useSaveTeamConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TeamConfig) =>
      unwrap(api.PUT("/api/v1/admin/teams/config", { body })),
    onSuccess: (data) => qc.setQueryData(teamConfigOptions.queryKey, data),
  })
}

export function adminTeamsOptions(f: {
  filter?: TeamFilter
  q?: string
  page: number
}) {
  return queryOptions({
    queryKey: adminTeamKeys.list(f),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/teams", {
          params: {
            query: {
              filter: f.filter,
              q: f.q || undefined,
              page: f.page,
              per: ADMIN_TEAMS_PER,
            },
          },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })
}

export function teamHistoryOptions(id: string) {
  return queryOptions({
    queryKey: adminTeamKeys.history(id),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/admin/teams/{id}/history", {
            params: { path: { id }, query: { per: 50 } },
            signal,
          })
        )
      ).items,
  })
}

/** Acciones del staff sobre un equipo. Todas llevan un motivo opcional y le avisan al líder. */
export type StaffAction =
  | { kind: "rename"; name: string; tag: string }
  | { kind: "logo" }
  | { kind: "kick"; playerId: string }
  | { kind: "captain"; playerId: string }
  | { kind: "add"; playerId: string; role: "player" | "sub" | "coach" }
  | { kind: "role"; playerId: string; role: "player" | "sub" | "coach" }
  | { kind: "dissolve" }

export function useStaffAction(teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      action: a,
      reason,
    }: {
      action: StaffAction
      reason: string
    }) => {
      const id = teamId
      const why = reason.trim() || undefined
      switch (a.kind) {
        case "rename":
          return unwrap(
            api.PATCH("/api/v1/admin/teams/{id}", {
              params: { path: { id } },
              body: { name: a.name, tag: a.tag, reason: why, force: false },
            })
          )
        case "captain":
          return unwrap(
            api.PATCH("/api/v1/admin/teams/{id}", {
              params: { path: { id } },
              body: {
                captain_player_id: a.playerId,
                reason: why,
                force: false,
              },
            })
          )
        case "logo":
          return unwrap(
            api.POST("/api/v1/admin/teams/{id}/logo/remove", {
              params: { path: { id } },
              body: { reason: why },
            })
          )
        case "kick":
          return unwrap(
            api.POST("/api/v1/admin/teams/{id}/members/{playerId}/remove", {
              params: { path: { id, playerId: a.playerId } },
              body: { reason: why },
            })
          )
        case "add":
          return unwrap(
            api.POST("/api/v1/admin/teams/{id}/members", {
              params: { path: { id } },
              body: { player_id: a.playerId, role: a.role, reason: why },
            })
          )
        case "role":
          return unwrap(
            api.PATCH("/api/v1/admin/teams/{id}/members/{playerId}", {
              params: { path: { id, playerId: a.playerId } },
              body: { role: a.role, reason: why },
            })
          )
        case "dissolve":
          return unwrap(
            api.POST("/api/v1/admin/teams/{id}/dissolve", {
              params: { path: { id } },
              body: { reason: why },
            })
          )
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminTeamKeys.all })
      void qc.invalidateQueries({ queryKey: ["team", teamId] })
      void qc.invalidateQueries({ queryKey: ["teams"] })
    },
  })
}

/** Crear un equipo a nombre de un jugador (solo admin). */
export function useAdminCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Schemas["AdminTeamCreate"]) =>
      unwrap(api.POST("/api/v1/admin/teams", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminTeamKeys.all }),
  })
}
