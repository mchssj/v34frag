import {
  queryOptions,
  useMutation,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { profileKeys } from "@/features/profile/queries"

// Equipos: Mi equipo, vista pública, Crear y Buscar (handoff_equipo). Bitácoras 2026-10-24-equipo y
// 2026-10-29-equipo-torneos-api-frontend.

export type TeamDetail = Schemas["TeamDetail"]
export type TeamSummary = Schemas["TeamSummary"]
export type RosterEntry = Schemas["RosterEntry"]
export type TeamInvite = Schemas["Invite"]
export type TeamRequest = Schemas["TeamRequest"]
export type MatchSummary = Schemas["MatchSummary"]
export type PlayerSummary = Schemas["PlayerSummary"]
export type MyTeamEntry = Schemas["MyTeam"]
export type TeamEvent = Schemas["TeamEvent"]
export type RosterStatusValue = Schemas["InviteBody"]["role"]

const MINUTE = 60_000

export const teamKeys = {
  // La comparte el breadcrumb del shell (features/shell/queries.ts).
  detail: (id: string) => ["team", id] as const,
  members: (id: string) => ["team", id, "members"] as const,
  pending: (id: string) => ["team", id, "pending"] as const,
  matches: (id: string) => ["team", id, "matches"] as const,
  star: (id: string) => ["team", id, "star"] as const,
  ranking: ["teams", "ranking"] as const,
  champions: ["teams", "champions"] as const,
  search: (q: string, lookingFor: string[]) =>
    ["teams", "search", q, lookingFor.join(",")] as const,
  events: (id: string) => ["team", id, "events"] as const,
  mine: ["teams", "mine"] as const,
  myInvites: ["teams", "my-invites"] as const,
  myRequest: ["teams", "my-request"] as const,
  players: (q: string) => ["teams", "players", q] as const,
}

export function teamDetailOptions(id: string) {
  return queryOptions({
    queryKey: teamKeys.detail(id),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/teams/{id}", { params: { path: { id } }, signal })
      ),
  })
}

type TeamLogoRef = { id: string; logo_url?: string | null }

/**
 * Completa el logo de los equipos que llegan sin `logo_url` (el historial de equipos y los títulos
 * de un jugador no lo traen; pedido al backend, E13). Usa el detalle de cada equipo, que es la
 * misma consulta de su página. Cuando la API lo mande, no pide nada.
 */
export function useTeamLogos(teams: TeamLogoRef[]) {
  const missing = [
    ...new Set(teams.filter((t) => t.logo_url === undefined).map((t) => t.id)),
  ]
  const logos = useQueries({
    queries: missing.map((id) => ({
      ...teamDetailOptions(id),
      select: (d: TeamDetail) => d.logo_url,
      staleTime: 5 * MINUTE,
    })),
  })
  const byId = new Map(missing.map((id, i) => [id, logos[i]?.data ?? null]))
  return <T extends TeamLogoRef>(t: T): T =>
    t.logo_url === undefined ? { ...t, logo_url: byId.get(t.id) ?? null } : t
}

/** Plantel actual (hasta 10). */
export function teamMembersOptions(id: string) {
  return queryOptions({
    queryKey: teamKeys.members(id),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/teams/{id}/members", {
            params: { path: { id }, query: { active: "true", per: 100 } },
            signal,
          })
        )
      ).items,
  })
}

/** Invitaciones enviadas y pedidos recibidos (solo el capitán o un admin). */
export function teamPendingOptions(id: string) {
  return queryOptions({
    queryKey: teamKeys.pending(id),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/teams/{id}/pending", {
            params: { path: { id }, query: { per: 100 } },
            signal,
          })
        )
      ).items,
  })
}

export function teamMatchesOptions(id: string) {
  return queryOptions({
    queryKey: teamKeys.matches(id),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/matches", {
            params: { query: { team: id, per: 5 } },
            signal,
          })
        )
      ).items,
    staleTime: MINUTE,
  })
}

/** El jugador del roster con mejor rating (null si nadie tiene rating). */
export function teamStarOptions(id: string) {
  return queryOptions({
    queryKey: teamKeys.star(id),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/players", {
            params: {
              query: { team: id, sort: "rating", order: "desc", per: 1 },
            },
            signal,
          })
        )
      ).items.find((p) => p.rating !== null) ?? null,
    staleTime: 5 * MINUTE,
  })
}

/** Ranking de equipos completo (son pocos): posición y puntos por id. */
export const teamRankingOptions = queryOptions({
  queryKey: teamKeys.ranking,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/ranking/teams", {
          params: { query: { per: 100 } },
          signal,
        })
      )
    ).items,
  staleTime: 5 * MINUTE,
})

/** Torneos terminados con campeón: de acá salen los títulos de cada equipo. */
export const championsOptions = queryOptions({
  queryKey: teamKeys.champions,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/events", {
          params: {
            query: {
              status: "finished",
              sort: "starts_on",
              order: "desc",
              per: 100,
            },
          },
          signal,
        })
      )
    ).items.filter((e) => e.champion !== null),
  staleTime: 10 * MINUTE,
})

/** Equipos oficiales por nombre o sigla, y por lo que buscan (Buscar equipo). */
export function teamSearchOptions(q: string, lookingFor: string[] = []) {
  return queryOptions({
    queryKey: teamKeys.search(q, lookingFor),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/teams", {
            params: {
              query: {
                kind: "official",
                per: 100,
                ...(q ? { q } : {}),
                ...(lookingFor.length
                  ? { looking_for: lookingFor.join(",") }
                  : {}),
              },
            },
            signal,
          })
        )
      ).items,
    placeholderData: (prev) => prev,
  })
}

/** Mis equipos con mi rol en cada uno (`leader` si soy el capitán). */
export const myTeamsOptions = queryOptions({
  queryKey: teamKeys.mine,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/me/teams", { signal })),
  staleTime: MINUTE,
})

/** Torneos en los que participó el equipo, del más reciente al más viejo (sin cancelados). */
export function teamEventsOptions(id: string) {
  return queryOptions({
    queryKey: teamKeys.events(id),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/teams/{id}/events", {
            params: { path: { id }, query: { per: 50 } },
            signal,
          })
        )
      ).items,
    staleTime: 5 * MINUTE,
  })
}

/** Invitaciones que recibí y pedidos para entrar que hice, abiertos. */
export const myInvitesOptions = queryOptions({
  queryKey: teamKeys.myInvites,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/me/team-invites", {
          params: { query: { per: 100 } },
          signal,
        })
      )
    ).items,
})

/** Mi solicitud de equipo nuevo (null si nunca pedí uno). */
export const myTeamRequestOptions = queryOptions({
  queryKey: teamKeys.myRequest,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/me/team-request", { signal })),
})

/** Jugadores por alias, para invitar. */
export function invitablePlayersOptions(q: string) {
  return queryOptions({
    queryKey: teamKeys.players(q),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/players", {
            params: { query: { q, per: 8, sort: "elo", order: "desc" } },
            signal,
          })
        )
      ).items,
    enabled: q.trim().length >= 2,
    placeholderData: (prev) => prev,
  })
}

// --- Mutaciones -----------------------------------------------------------

/** Tras cualquier cambio de plantel se refresca el equipo, sus pendientes y Mi perfil. */
function useInvalidateTeam() {
  const queryClient = useQueryClient()
  return (id?: string) => {
    if (id) void queryClient.invalidateQueries({ queryKey: ["team", id] })
    void queryClient.invalidateQueries({ queryKey: teamKeys.myInvites })
    void queryClient.invalidateQueries({ queryKey: teamKeys.mine })
    void queryClient.invalidateQueries({ queryKey: profileKeys.mine })
  }
}

/** Arma el multipart a mano: el schema tipa los archivos como string (binary). */
function formWith(fields: Record<string, string | Blob | undefined>) {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields))
    if (v instanceof Blob)
      form.append(k, v, `${k}.${v.type === "image/png" ? "png" : "jpg"}`)
    else if (v !== undefined) form.append(k, v)
  return form
}

export function useRequestTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      logo,
      ...body
    }: Schemas["TeamRequestBody"] & { logo?: Blob }) =>
      unwrap(
        api.PUT("/api/v1/me/team-request", {
          body,
          // Con logo va en multipart; sin logo, JSON (el backend conserva el que tenía).
          ...(logo && { bodySerializer: () => formWith({ ...body, logo }) }),
        })
      ),
    onSuccess: (request) =>
      queryClient.setQueryData(teamKeys.myRequest, request),
  })
}

export function useJoinTeam() {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST("/api/v1/teams/{id}/join-requests", {
          params: { path: { id } },
        })
      ),
    onSuccess: (_, id) => invalidate(id),
  })
}

/** Cancela un pedido propio para entrar. */
export function useCancelJoin() {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: ({ requestId }: { requestId: string; teamId: string }) =>
      unwrap(
        api.DELETE("/api/v1/join-requests/{id}", {
          params: { path: { id: requestId } },
        })
      ),
    onSuccess: (_, { teamId }) => invalidate(teamId),
  })
}

/** Aceptar o rechazar un pedido recibido (capitán). */
export function useAnswerJoin() {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: ({
      requestId,
      accept,
    }: {
      requestId: string
      accept: boolean
      teamId: string
    }) =>
      unwrap(
        accept
          ? api.POST("/api/v1/join-requests/{id}/accept", {
              params: { path: { id: requestId } },
            })
          : api.POST("/api/v1/join-requests/{id}/reject", {
              params: { path: { id: requestId } },
            })
      ),
    onSuccess: (_, { teamId }) => invalidate(teamId),
  })
}

/** Aceptar o rechazar una invitación recibida. */
export function useAnswerInvite() {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: ({
      inviteId,
      accept,
    }: {
      inviteId: string
      accept: boolean
      teamId: string
    }) =>
      unwrap(
        accept
          ? api.POST("/api/v1/team-invites/{id}/accept", {
              params: { path: { id: inviteId } },
            })
          : api.POST("/api/v1/team-invites/{id}/reject", {
              params: { path: { id: inviteId } },
            })
      ),
    onSuccess: (_, { teamId }) => invalidate(teamId),
  })
}

export function useInvitePlayer() {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: ({
      teamId,
      playerId,
      role,
      message,
    }: {
      teamId: string
      playerId: string
      role: RosterStatusValue
      message?: string
    }) =>
      unwrap(
        api.POST("/api/v1/teams/{id}/invites", {
          params: { path: { id: teamId } },
          body: { player_id: playerId, role, ...(message ? { message } : {}) },
        })
      ),
    onSuccess: (_, { teamId }) => invalidate(teamId),
  })
}

export function useCancelInvite() {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: ({ inviteId }: { inviteId: string; teamId: string }) =>
      unwrap(
        api.DELETE("/api/v1/team-invites/{id}", {
          params: { path: { id: inviteId } },
        })
      ),
    onSuccess: (_, { teamId }) => invalidate(teamId),
  })
}

export function useLeaveTeam() {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST("/api/v1/teams/{id}/leave", { params: { path: { id } } })
      ),
    onSuccess: (_, id) => invalidate(id),
  })
}

export function useKickMember() {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: ({ teamId, playerId }: { teamId: string; playerId: string }) =>
      unwrap(
        api.DELETE("/api/v1/teams/{id}/members/{playerId}", {
          params: { path: { id: teamId, playerId } },
        })
      ),
    onSuccess: (_, { teamId }) => invalidate(teamId),
  })
}

/** Ceder el liderazgo (capitanía) a un jugador del plantel con cuenta. */
export function useTransferCaptain() {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: ({ teamId, playerId }: { teamId: string; playerId: string }) =>
      unwrap(
        api.POST("/api/v1/teams/{id}/captain", {
          params: { path: { id: teamId } },
          body: { player_id: playerId },
        })
      ),
    onSuccess: (_, { teamId }) => invalidate(teamId),
  })
}

/** Estado de un miembro en el roster (capitán o admin), sin topes por estado. */
export function useSetMemberRole() {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: ({
      teamId,
      playerId,
      role,
    }: {
      teamId: string
      playerId: string
      role: RosterStatusValue
    }) =>
      unwrap(
        api.PATCH("/api/v1/teams/{id}/members/{playerId}", {
          params: { path: { id: teamId, playerId } },
          body: { role },
        })
      ),
    onSuccess: (_, { teamId }) => invalidate(teamId),
  })
}

/** Logo del equipo, ya recortado (capitán o admin). */
export function useUploadLogo() {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: ({ teamId, blob }: { teamId: string; blob: Blob }) =>
      unwrap(
        api.PUT("/api/v1/teams/{id}/logo", {
          params: { path: { id: teamId } },
          body: { file: "" },
          bodySerializer: () => formWith({ file: blob }),
        })
      ),
    onSuccess: (_, { teamId }) => invalidate(teamId),
  })
}

/** Quita el logo: el escudo vuelve a la sigla. */
export function useRemoveLogo() {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: (teamId: string) =>
      unwrap(
        api.DELETE("/api/v1/teams/{id}/logo", {
          params: { path: { id: teamId } },
        })
      ),
    onSuccess: (_, teamId) => invalidate(teamId),
  })
}

/** Qué busca el equipo (`[]` = no busca). Capitán o admin. */
export function useSetLookingFor() {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: ({
      teamId,
      lookingFor,
    }: {
      teamId: string
      lookingFor: TeamSummary["looking_for"]
    }) =>
      unwrap(
        api.PATCH("/api/v1/teams/{id}", {
          params: { path: { id: teamId } },
          body: { looking_for: lookingFor },
        })
      ),
    onSuccess: (_, { teamId }) => invalidate(teamId),
  })
}
