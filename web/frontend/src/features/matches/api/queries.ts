import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { MIXES_REFRESH_MS } from "@/features/mixes/api/queries"
import { toMatchesQuery, type MatchesSearch } from "../lib/search"
import type { MatchSummary } from "../types"
type MatchPage = Omit<Schemas["MatchList"], "items"> & { items: MatchSummary[] }

export const matchKeys = {
  list: (s: MatchesSearch) => ["matches", "list", toMatchesQuery(s)] as const,
}

export function matchesListOptions(search: MatchesSearch) {
  return queryOptions({
    queryKey: matchKeys.list(search),
    queryFn: ({ signal }): Promise<MatchPage> =>
      unwrap(
        api.GET("/api/v1/matches", {
          params: { query: toMatchesQuery(search) },
          signal,
        })
      ),
    // Al cambiar de página o de filtro, la tabla anterior queda hasta que llega la nueva.
    placeholderData: keepPreviousData,
    refetchInterval: MIXES_REFRESH_MS,
  })
}
