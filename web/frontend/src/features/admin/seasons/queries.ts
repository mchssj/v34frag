import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { rankingKeys } from "@/features/ranking/queries"

// Administración › Temporadas (contrato temporadas.md, sección 8f).

export type Season = Schemas["Season"]
export type SeasonTier = Schemas["SeasonTier"]
export type SeasonConfig = Schemas["SeasonConfig"]
export type SeasonPatch = Schemas["SeasonPatch"]

export const seasonConfigOptions = queryOptions({
  queryKey: ["admin", "seasons", "config"] as const,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/admin/seasons/config", { signal })),
})

/** Jugadores de la temporada y cuántos llegan al mínimo, para el encabezado. */
export function seasonCountsOptions(id: string) {
  return queryOptions({
    queryKey: ["admin", "seasons", "counts", id] as const,
    queryFn: async ({ signal }) => {
      const get = (eligible?: "true") =>
        unwrap(
          api.GET("/api/v1/seasons/{id}/standings", {
            params: {
              path: { id },
              query: { per: 1, ...(eligible ? { eligible } : {}) },
            },
            signal,
          })
        )
      const [all, ranked] = await Promise.all([get(), get("true")])
      return { players: all.total, ranked: ranked.total }
    },
  })
}

export type PreviewParams = {
  top_n: number
  min_matches: number
  reset_pct: number
  reset_floor: number
}
export type PreviewFilter = "medal" | "reset" | undefined

export function seasonPreviewOptions(
  p: PreviewParams,
  filter: PreviewFilter,
  q: string,
  page: number
) {
  return queryOptions({
    queryKey: ["admin", "seasons", "preview", p, filter, q, page] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/seasons/preview", {
          params: {
            query: {
              ...p,
              page,
              per: 25,
              ...(filter ? { [filter]: "true" as const } : {}),
              ...(q ? { q } : {}),
            },
          },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })
}

const touched = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ["admin", "seasons"] as const })
  return qc.invalidateQueries({ queryKey: rankingKeys.all })
}

export function useSaveSeasonConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SeasonConfig) =>
      unwrap(api.PUT("/api/v1/admin/seasons/config", { body })),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: seasonConfigOptions.queryKey }),
  })
}

export function useOpenSeason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/admin/seasons", { body: {} })),
    onSuccess: () => touched(qc),
  })
}

export function usePatchSeason(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SeasonPatch) =>
      unwrap(
        api.PATCH("/api/v1/admin/seasons/{id}", {
          params: { path: { id } },
          body,
        })
      ),
    onSuccess: () => touched(qc),
  })
}

export function useCloseSeason(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (confirm: string) =>
      unwrap(
        api.POST("/api/v1/admin/seasons/{id}/close", {
          params: { path: { id } },
          body: { confirm },
        })
      ),
    onSuccess: () => touched(qc),
  })
}
