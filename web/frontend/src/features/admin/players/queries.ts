import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { playerDetailOptions } from "@/features/profile/queries"

// Administración › Jugadores: fichas, sus SteamID y los pedidos de !claim (contrato admin.md).

export type PlayerSummary = Schemas["PlayerSummary"]
export type PlayerDetail = Schemas["PlayerDetail"]
export type Medal = Schemas["Medal"]
export type SteamRequest = Schemas["AdminSteamRequest"]
export type SteamUnlinked = Schemas["SteamUnlinked"]
export type PlayerIp = Schemas["PlayerIp"]
// `force` (guardar igual con una palabra bloqueada) tiene default en la API: acá es opcional.
export type PlayerPatch = Omit<Schemas["AdminPlayerPatch"], "force"> & {
  force?: boolean
}

export { playerDetailOptions }

export type FichaFilter = "all" | "account" | "noaccount" | "nosteam"
export const PLAYERS_PER = 25

export const adminPlayerKeys = {
  list: (q: string, f: FichaFilter, page: number) =>
    ["admin", "players", "list", q, f, page] as const,
  medals: (id: string) => ["player", id, "medals"] as const,
  ips: (id: string) => ["admin", "players", "ips", id] as const,
  requests: (pendingOnly: boolean) =>
    ["admin", "players", "steam-requests", pendingOnly] as const,
  steamConfig: ["admin", "players", "steam-config"] as const,
  unlinked: (q: string, page: number) =>
    ["admin", "players", "unlinked", q, page] as const,
  freeAccounts: (q: string) =>
    ["admin", "players", "free-accounts", q] as const,
  pick: (q: string) => ["admin", "players", "pick", q] as const,
}

export function playersListOptions(q: string, f: FichaFilter, page: number) {
  return queryOptions({
    queryKey: adminPlayerKeys.list(q, f, page),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/players", {
          params: {
            query: {
              page,
              per: PLAYERS_PER,
              sort: "alias",
              order: "asc",
              ...(q ? { q } : {}),
              ...(f === "account" ? { has_account: "true" as const } : {}),
              ...(f === "noaccount" ? { has_account: "false" as const } : {}),
              ...(f === "nosteam" ? { has_steam: "false" as const } : {}),
            },
          },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })
}

export function medalsOptions(id: string) {
  return queryOptions({
    queryKey: adminPlayerKeys.medals(id),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/players/{id}/medals", {
          params: { path: { id }, query: { per: 50 } },
          signal,
        })
      ),
  })
}

/** IPs desde las que entró la ficha (solo admin; las registra el reporter al entrar al servidor). */
export function playerIpsOptions(id: string) {
  return queryOptions({
    queryKey: adminPlayerKeys.ips(id),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/players/{id}/ips", {
          params: { path: { id } },
          signal,
        })
      ),
  })
}

/** Cuentas sin ficha, para vincular una. */
export function freeAccountsOptions(q: string) {
  return queryOptions({
    queryKey: adminPlayerKeys.freeAccounts(q),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/users", {
          params: {
            query: { has_player: "false", per: 6, ...(q ? { q } : {}) },
          },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })
}

/** Fichas para elegir a cuál sumar un SteamID (menos de 4). */
export function pickPlayerOptions(q: string) {
  return queryOptions({
    queryKey: adminPlayerKeys.pick(q),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/players", {
          params: {
            query: { per: 8, sort: "alias", order: "asc", ...(q ? { q } : {}) },
          },
          signal,
        })
      ),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
  })
}

const touched = (qc: ReturnType<typeof useQueryClient>, id?: string) => {
  void qc.invalidateQueries({ queryKey: ["admin", "players"] as const })
  if (id) void qc.invalidateQueries({ queryKey: ["player", id] as const })
}

export function useCreatePlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { nick: string; force?: boolean }) =>
      unwrap(
        api.POST("/api/v1/admin/players", {
          body: { ...body, force: body.force ?? false },
        })
      ),
    onSuccess: () => touched(qc),
  })
}

export function useUpdatePlayer(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PlayerPatch) =>
      unwrap(
        api.PATCH("/api/v1/admin/players/{id}", {
          params: { path: { id } },
          body: { ...body, force: body.force ?? false },
        })
      ),
    onSuccess: () => touched(qc, id),
  })
}

export function useDeletePlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/api/v1/admin/players/{id}", { params: { path: { id } } })
      ),
    onSuccess: () => touched(qc),
  })
}

export function useUploadPlayerPhoto(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (blob: Blob) =>
      unwrap(
        api.POST("/api/v1/admin/players/{id}/photo", {
          params: { path: { id } },
          // El schema tipa `file` como string (binary); se arma el multipart a mano.
          body: { file: "" },
          bodySerializer: () => {
            const form = new FormData()
            form.append("file", blob, "photo.jpg")
            return form
          },
        })
      ),
    onSuccess: () => touched(qc, id),
  })
}

export function useAddMedal(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { title: string; icon?: string }) =>
      unwrap(
        api.POST("/api/v1/admin/players/{id}/medals", {
          params: { path: { id } },
          // Sin ícono, el mismo que pone la API por defecto.
          body: { title: body.title, icon: body.icon ?? "🏆" },
        })
      ),
    onSuccess: () => touched(qc, id),
  })
}

export function useDeleteMedal(playerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/api/v1/admin/medals/{id}", { params: { path: { id } } })
      ),
    onSuccess: () => touched(qc, playerId),
  })
}

// ---------- SteamID ----------

export function useRemoveSteam(playerId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (steamid: string) =>
      unwrap(
        api.DELETE("/api/v1/admin/steam/{steamid}", {
          params: { path: { steamid } },
        })
      ),
    onSuccess: () => touched(qc, playerId),
  })
}

export function useMakePrimary(playerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (steamid: string) =>
      unwrap(
        api.POST("/api/v1/admin/steam/{steamid}/primary", {
          params: { path: { steamid } },
        })
      ),
    onSuccess: () => touched(qc, playerId),
  })
}

export function useLinkSteam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { steam_id: string; player_id: string }) =>
      unwrap(api.POST("/api/v1/admin/steam/link", { body })),
    onSuccess: (_, v) => touched(qc, v.player_id),
  })
}

export function steamRequestsOptions(pendingOnly: boolean) {
  return queryOptions({
    queryKey: adminPlayerKeys.requests(pendingOnly),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/steam-requests", {
          params: {
            query: {
              per: 50,
              ...(pendingOnly ? { status: "pending" as const } : {}),
            },
          },
          signal,
        })
      ),
    refetchInterval: 60_000,
  })
}

export function useApproveSteamRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (r: SteamRequest) =>
      unwrap(
        api.POST("/api/v1/admin/steam-requests/{id}/approve", {
          params: { path: { id: r.id } },
        })
      ),
    onSuccess: (_, r) => touched(qc, r.player.id),
  })
}

export function useRejectSteamRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      unwrap(
        api.POST("/api/v1/admin/steam-requests/{id}/reject", {
          params: { path: { id } },
          body: reason ? { reason } : {},
        })
      ),
    onSuccess: () => touched(qc),
  })
}

export const steamConfigOptions = queryOptions({
  queryKey: adminPlayerKeys.steamConfig,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/admin/steam/config", { signal })),
})

export function useSaveSteamConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (max: number) =>
      unwrap(
        api.PUT("/api/v1/admin/steam/config", { body: { max_steam_ids: max } })
      ),
    onSuccess: (data) => qc.setQueryData(adminPlayerKeys.steamConfig, data),
  })
}

export const UNLINKED_PER = 25

export function unlinkedOptions(q: string, page: number) {
  return queryOptions({
    queryKey: adminPlayerKeys.unlinked(q, page),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/steam/unlinked", {
          params: { query: { page, per: UNLINKED_PER, ...(q ? { q } : {}) } },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })
}
