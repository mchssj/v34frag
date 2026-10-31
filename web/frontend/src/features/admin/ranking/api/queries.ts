import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { rankingKeys } from "@/features/ranking/api/queries"
import type { RankingConfig } from "../types"

export const rankingConfigOptions = queryOptions({
  queryKey: ["admin", "ranking", "config"] as const,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/admin/ranking/config", { signal })),
})

/** Los primeros del ranking de torneos (sin PCW), para ver cómo quedarían con otro valor. */
export const rankingTopOptions = queryOptions({
  queryKey: ["admin", "ranking", "top"] as const,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/ranking/teams", {
          params: { query: { per: 10, pcw: "0" } },
          signal,
        })
      )
    ).items,
})

export function useSaveRankingConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RankingConfig) =>
      unwrap(api.PUT("/api/v1/admin/ranking/config", { body })),
    onSuccess: (data) => {
      qc.setQueryData(rankingConfigOptions.queryKey, data)
      void qc.invalidateQueries({ queryKey: rankingKeys.all })
      return qc.invalidateQueries({ queryKey: ["admin", "ranking", "top"] })
    },
  })
}
