import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"

// Administración › Clips: reglas de las jugadas destacadas y los videos reprocesados que esperan
// el "Bien" (contrato admin.md, "Clips (admin)").

export type ClipConfig = Schemas["ClipConfigValues"]
export type ClipConfigPatch = Schemas["ClipConfigPatch"]
export type ClipReview = Schemas["ClipReview"]
export type ClipType = Schemas["Clip"]["type"]

export const clipKeys = {
  config: ["admin", "clips", "config"] as const,
  review: ["admin", "clips", "review"] as const,
}

export const clipConfigOptions = queryOptions({
  queryKey: clipKeys.config,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/admin/clips/config", { signal })),
})

/** Los reprocesados que esperan revisión, del más viejo al más nuevo. */
export const clipReviewOptions = queryOptions({
  queryKey: clipKeys.review,
  queryFn: ({ signal }) =>
    unwrap(
      api.GET("/api/v1/admin/clips/review", {
        params: { query: { per: 50, sort: "reprocessed_at", order: "asc" } },
        signal,
      })
    ),
  // Un video que se está grabando aparece listo sin recargar la página.
  refetchInterval: 30_000,
})

export function useSaveClipConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ClipConfigPatch) =>
      unwrap(api.PATCH("/api/v1/admin/clips/config", { body })),
    onSuccess: (data) => qc.setQueryData(clipKeys.config, data),
  })
}

const touched = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: clipKeys.review })

export function useApproveClip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST("/api/v1/admin/clips/{id}/approve", {
          params: { path: { id } },
        })
      ),
    onSuccess: () => touched(qc),
  })
}

export function useReprocessClip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST("/api/v1/admin/clips/{id}/reprocess", {
          params: { path: { id } },
        })
      ),
    onSuccess: () => touched(qc),
  })
}

/** Cuántos esperan revisión, para el contador del sidebar. */
export const clipReviewCountOptions = queryOptions({
  queryKey: [...clipKeys.review, "count"] as const,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/admin/clips/review", {
          params: { query: { per: 1 } },
          signal,
        })
      )
    ).total,
  staleTime: 60_000,
})
