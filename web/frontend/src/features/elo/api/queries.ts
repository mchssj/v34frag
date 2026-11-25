import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"

export const PER = 12

export function eloBreakdownOptions(page: number) {
  return queryOptions({
    queryKey: ["my-elo-breakdown", page] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/me/elo/breakdown", {
          params: { query: { page, per: PER } },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}
