import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import type { AdminClipStatus, ClipConfigPatch, ClipType } from "../types"

export const clipKeys = {
  config: ["admin", "clips", "config"] as const,
  review: ["admin", "clips", "review"] as const,
  list: ["admin", "clips", "list"] as const,
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clipKeys.list })
      return touched(qc)
    },
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

// Lista de clips para reprocesar varios a la vez (plan docs/bitacora/2026-11-03-reportes-clips-nombre-equipo).
export type ClipListFilters = {
  status?: AdminClipStatus
  type?: ClipType
  q?: string
}

export function clipListOptions(f: ClipListFilters, page: number, per: number) {
  return queryOptions({
    queryKey: [
      ...clipKeys.list,
      f.status ?? "",
      f.type ?? "",
      f.q ?? "",
      page,
      per,
    ] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/clips", {
          params: {
            query: { page, per, sort: "created_at", order: "desc", ...f },
          },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
    // Un video que se está grabando cambia de estado sin recargar.
    refetchInterval: 30_000,
  })
}

/** Reprocesar varios: la API los hace uno por uno y devuelve el resultado de cada uno. */
export function useReprocessClips() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      unwrap(api.POST("/api/v1/admin/clips/reprocess", { body: { ids } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clipKeys.list })
      return touched(qc)
    },
  })
}

// Rechazar y recuperar (replanteo 76): un clip que sigue saliendo mal deja de verse y de grabarse.
const touchedAll = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: clipKeys.list })
  return touched(qc)
}

/** Rechazar uno (desde Para revisar), con el motivo opcional. */
export function useRejectClip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      unwrap(
        api.POST("/api/v1/admin/clips/{id}/reject", {
          params: { path: { id } },
          body: reason ? { reason } : {},
        })
      ),
    onSuccess: () => touchedAll(qc),
  })
}

/** Rechazar varios (desde la lista): uno por uno, con el resultado de cada uno. */
export function useRejectClips() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, reason }: { ids: string[]; reason?: string }) =>
      unwrap(
        api.POST("/api/v1/admin/clips/reject", {
          body: reason ? { ids, reason } : { ids },
        })
      ),
    onSuccess: () => touchedAll(qc),
  })
}

/** Recuperar rechazados: se vuelven a grabar y pasan a Para revisar. */
export function useRestoreClips() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      unwrap(api.POST("/api/v1/admin/clips/restore", { body: { ids } })),
    onSuccess: () => touchedAll(qc),
  })
}
