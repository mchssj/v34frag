import { queryOptions } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"

export const mapKeys = {
  all: ["maps"] as const,
}

export const mapsOptions = queryOptions({
  queryKey: mapKeys.all,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/maps", {
          params: { query: { include_inactive: "true", per: 100 } },
          signal,
        })
      )
    ).items,
  staleTime: 10 * 60_000,
})
