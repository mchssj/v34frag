import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { errorFromResponse, isApiError, networkError } from "@/api/errors"
import { shellKeys } from "@/features/shell/queries"

export type MixItem = Schemas["MixItem"]
export type MixStats = Schemas["MixStats"]
export type LiveMixDetail = Schemas["LiveMixDetail"]
export type EloChoice = Schemas["DeleteMixBody"]["elo"]

// Sin SSE por ahora (contrato 8d): el listado y la sala en vivo se consultan cada 20 segundos.
export const MIXES_REFRESH_MS = 20_000

export const mixKeys = {
  all: ["mixes"] as const,
  liveList: ["mixes", "live-list"] as const,
  stats: ["mixes", "stats"] as const,
  live: (uid: string) => ["mixes", "live", uid] as const,
}

/** Mixes en juego, para el bloque "En vivo" de Partidas (/matches no los trae). */
export const liveMixesOptions = queryOptions({
  queryKey: mixKeys.liveList,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/mixes", {
          params: { query: { status: "live", per: 20 } },
          signal,
        })
      )
    ).items,
  refetchInterval: MIXES_REFRESH_MS,
})

export const mixStatsOptions = queryOptions({
  queryKey: mixKeys.stats,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/mixes/stats", { signal })),
  refetchInterval: MIXES_REFRESH_MS,
})

// Última foto de cada mix en vivo con su ETag: con If-None-Match la API contesta 304 hasta la
// próxima ronda y se reusa la que ya está.
const liveCache = new Map<string, { etag: string; data: LiveMixDetail }>()

export async function fetchLiveMix(
  uid: string,
  signal?: AbortSignal
): Promise<LiveMixDetail> {
  const cached = liveCache.get(uid)
  let result
  try {
    result = await api.GET("/api/v1/mixes/live/{uid}", {
      params: { path: { uid } },
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
    liveCache.delete(uid)
    throw errorFromResponse(response, error)
  }
  const etag = response.headers.get("ETag")
  if (etag) liveCache.set(uid, { etag, data })
  return data
}

export function liveMixOptions(uid: string) {
  return queryOptions({
    queryKey: mixKeys.live(uid),
    queryFn: ({ signal }) => fetchLiveMix(uid, signal),
    refetchInterval: (q) =>
      isApiError(q.state.error, "NOT_FOUND") ? false : MIXES_REFRESH_MS,
    // 404 = el mix terminó: no tiene sentido reintentar.
    retry: (failures, e) => failures < 2 && !isApiError(e, "NOT_FOUND"),
  })
}

export function useDeleteMix(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (elo: EloChoice) =>
      unwrap(
        api.DELETE("/api/v1/admin/mixes/{id}", {
          params: { path: { id } },
          body: { elo, confirm: "estoy seguro" },
        })
      ),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: shellKeys.match(id) })
      return queryClient.invalidateQueries({ queryKey: mixKeys.all })
    },
  })
}
