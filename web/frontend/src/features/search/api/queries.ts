import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import type { SavedSearch, SearchKind } from "../types"

/** Tope por tipo, el mismo de la base (replanteo 141). */
export const MAX_SAVED = 5

const savedKey = (kind: SearchKind) => ["saved-searches", kind] as const

export function savedSearchesOptions(kind: SearchKind) {
  return queryOptions({
    queryKey: savedKey(kind),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/me/searches", {
            params: { query: { kind, per: MAX_SAVED } },
            signal,
          })
        )
      ).items,
    staleTime: 5 * 60_000,
  })
}

export function useSaveSearch(kind: SearchKind) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; query: SavedSearch["query"] }) =>
      unwrap(api.PUT("/api/v1/me/searches", { body: { kind, ...body } })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: savedKey(kind) }),
  })
}

export function useDeleteSearch(kind: SearchKind) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/api/v1/me/searches/{id}", { params: { path: { id } } })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: savedKey(kind) }),
  })
}
