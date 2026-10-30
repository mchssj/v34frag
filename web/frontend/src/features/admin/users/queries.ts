import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"

// Administración › Usuarios: cuentas (alias, rol, VIP y la marca de streamer del HUD) y palabras bloqueadas.

export type AdminUser = Schemas["AdminUser"]
export type BlockedHit = Schemas["BlockedHit"]
export type VipGrant = Schemas["VipGrant"]
export type Streamer = Schemas["Streamer"]
export type SettableRole = "user" | "organizer" | "moderator"

export type AccountFilter =
  "all" | "admin" | "moderator" | "organizer" | "streamer" | "noplayer"

export const USERS_PER = 25

export const adminUserKeys = {
  list: (q: string, f: AccountFilter, page: number) =>
    ["admin", "users", "list", q, f, page] as const,
  vip: (id: string) => ["admin", "users", "vip", id] as const,
  streamer: (alias: string) => ["admin", "users", "streamer", alias] as const,
  words: ["admin", "words", "list"] as const,
  hits: ["admin", "words", "hits"] as const,
}

export function usersOptions(q: string, f: AccountFilter, page: number) {
  return queryOptions({
    queryKey: adminUserKeys.list(q, f, page),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/users", {
          params: {
            query: {
              page,
              per: USERS_PER,
              ...(q ? { q } : {}),
              ...(f === "admin" || f === "moderator" || f === "organizer"
                ? { role: f }
                : {}),
              ...(f === "noplayer" ? { has_player: "false" as const } : {}),
              ...(f === "streamer" ? { streamer: "true" as const } : {}),
            },
          },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })
}

const touchedUsers = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["admin", "users"] as const })

export function useSetAlias(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ alias, force }: { alias: string; force: boolean }) =>
      unwrap(
        api.PUT("/api/v1/admin/users/{id}/alias", {
          params: { path: { id } },
          body: { alias, force },
        })
      ),
    onSuccess: () => {
      void touchedUsers(qc)
      void qc.invalidateQueries({ queryKey: ["admin", "words"] as const })
      void qc.invalidateQueries({ queryKey: ["player"] as const })
    },
  })
}

export function useSetRole(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (role: SettableRole) =>
      unwrap(
        api.PUT("/api/v1/admin/users/{id}/role", {
          params: { path: { id } },
          body: { role },
        })
      ),
    onSuccess: () => touchedUsers(qc),
  })
}

export function userVipOptions(id: string) {
  return queryOptions({
    queryKey: adminUserKeys.vip(id),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/users/{id}/vip", {
          params: { path: { id } },
          signal,
        })
      ),
  })
}

export function useGrantVip(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: VipGrant) =>
      unwrap(
        api.POST("/api/v1/admin/users/{id}/vip", {
          params: { path: { id } },
          body,
        })
      ),
    onSuccess: (data) => {
      qc.setQueryData(adminUserKeys.vip(id), data)
      void touchedUsers(qc)
    },
  })
}

export function useRevokeVip(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) =>
      unwrap(
        api.POST("/api/v1/admin/users/{id}/vip/revoke", {
          params: { path: { id } },
          body: { reason },
        })
      ),
    onSuccess: (data) => {
      qc.setQueryData(adminUserKeys.vip(id), data)
      void touchedUsers(qc)
    },
  })
}

// ---------- palabras bloqueadas ----------

export const wordsOptions = queryOptions({
  queryKey: adminUserKeys.words,
  queryFn: ({ signal }) =>
    unwrap(
      api.GET("/api/v1/admin/blocked-words", {
        params: { query: { per: 100 } },
        signal,
      })
    ),
})

export const hitsOptions = queryOptions({
  queryKey: adminUserKeys.hits,
  queryFn: ({ signal }) =>
    unwrap(
      api.GET("/api/v1/admin/blocked-words/hits", {
        params: { query: { per: 100 } },
        signal,
      })
    ),
})

const touchedWords = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["admin", "words"] as const })

export function useAddWord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (word: string) =>
      unwrap(api.POST("/api/v1/admin/blocked-words", { body: { word } })),
    onSuccess: () => touchedWords(qc),
  })
}

export function useDeleteWord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/api/v1/admin/blocked-words/{id}", {
          params: { path: { id } },
        })
      ),
    onSuccess: () => touchedWords(qc),
  })
}

/** La marca de streamer de una cuenta (también si se la quitaron), o null si nunca la tuvo. */
export function streamerOptions(id: string, alias: string) {
  return queryOptions({
    queryKey: adminUserKeys.streamer(alias),
    queryFn: async ({ signal }) => {
      const res = await unwrap(
        api.GET("/api/v1/admin/streamers", {
          params: { query: { q: alias, per: 100 } },
          signal,
        })
      )
      return res.items.find((s) => s.user.id === id) ?? null
    },
  })
}

function useStreamerMutation(
  id: string,
  path:
    | "/api/v1/admin/users/{id}/streamer"
    | "/api/v1/admin/users/{id}/streamer/revoke"
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => unwrap(api.POST(path, { params: { path: { id } } })),
    onSuccess: () => touchedUsers(qc),
  })
}

export const useGrantStreamer = (id: string) =>
  useStreamerMutation(id, "/api/v1/admin/users/{id}/streamer")
export const useRevokeStreamer = (id: string) =>
  useStreamerMutation(id, "/api/v1/admin/users/{id}/streamer/revoke")
