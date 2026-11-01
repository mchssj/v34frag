import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { errorFromResponse, networkError } from "@/api/errors"
import { profileKeys } from "@/features/profile/queries"
import type { Notification } from "./model"

// Contrato notificaciones.md: el contador se consulta cada 30 s, al enfocar la pestaña y después de
// cada acción propia, siempre con If-None-Match; la lista, solo al abrir el menú.

export const NOTIFICATIONS_REFRESH_MS = 30_000

export const notificationKeys = {
  all: ["notifications"] as const,
  count: ["notifications", "count"] as const,
  list: ["notifications", "list"] as const,
}

type UnreadCount = Schemas["UnreadCount"]
let countCache: { etag: string; data: UnreadCount } | null = null

async function fetchUnreadCount(signal?: AbortSignal): Promise<UnreadCount> {
  const cached = countCache
  let result
  try {
    result = await api.GET("/api/v1/notifications/unread-count", {
      headers: cached ? { "If-None-Match": cached.etag } : undefined,
      signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e
    throw networkError()
  }
  const { data, error, response } = result
  if (response.status === 304 && cached) return cached.data
  if (error !== undefined || !response.ok || !data) {
    countCache = null
    throw errorFromResponse(response, error)
  }
  const etag = response.headers.get("ETag")
  countCache = etag ? { etag, data } : null
  return data
}

export const unreadCountOptions = queryOptions({
  queryKey: notificationKeys.count,
  queryFn: ({ signal }) => fetchUnreadCount(signal),
  refetchInterval: NOTIFICATIONS_REFRESH_MS,
  refetchOnWindowFocus: true,
})

export const notificationsOptions = queryOptions({
  queryKey: notificationKeys.list,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/notifications", {
          params: { query: { per: 100 } },
          signal,
        })
      )
    ).items,
})

/** Marca leídas (`ids`) o todas; actualiza la lista sin esperar a la API. */
export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[] | "all") =>
      unwrap(
        api.POST("/api/v1/notifications/read", {
          body: ids === "all" ? { all: true } : { ids },
        })
      ),
    onMutate: (ids) => {
      queryClient.setQueryData<Notification[]>(notificationKeys.list, (old) =>
        old?.map((n) =>
          ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n
        )
      )
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export type Resolution = "accepted" | "rejected"

/** Acepta o rechaza una invitación o un pedido para entrar, con sus endpoints de siempre. */
export function useResolveRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      item,
      resolution,
    }: {
      item: Notification
      resolution: Resolution
    }) => {
      const id = String(item.data.invite_id ?? "")
      const params = { params: { path: { id } } }
      const verb = resolution === "accepted" ? "accept" : "reject"
      if (item.type === "team_join_request") {
        await unwrap(
          verb === "accept"
            ? api.POST("/api/v1/join-requests/{id}/accept", params)
            : api.POST("/api/v1/join-requests/{id}/reject", params)
        )
      } else {
        await unwrap(
          verb === "accept"
            ? api.POST("/api/v1/team-invites/{id}/accept", params)
            : api.POST("/api/v1/team-invites/{id}/reject", params)
        )
      }
      // La base resuelve la notificación sola; queda leída.
      await unwrap(
        api.POST("/api/v1/notifications/read", { body: { ids: [item.id] } })
      )
    },
    onSuccess: (_, { item, resolution }) =>
      queryClient.setQueryData<Notification[]>(notificationKeys.list, (old) =>
        old?.map((n) =>
          n.id === item.id ? { ...n, resolution, read: true } : n
        )
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      // Aceptar cambia el equipo del usuario.
      void queryClient.invalidateQueries({ queryKey: profileKeys.mine })
    },
  })
}
