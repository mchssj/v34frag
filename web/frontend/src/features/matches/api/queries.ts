import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { MIXES_REFRESH_MS } from "@/features/mixes/api/queries"
import { toMatchesQuery, type MatchesSearch } from "../lib/search"
import type { MatchItem } from "../types"
type MatchPage = Omit<Schemas["MatchList"], "items"> & { items: MatchItem[] }

const LISTS = ["matches", "list"] as const
export const matchKeys = {
  list: (s: MatchesSearch, vip = false) =>
    [...LISTS, toMatchesQuery(s, vip)] as const,
}

/** `vip`: sin VIP, los filtros avanzados de la URL no se mandan. */
export function matchesListOptions(search: MatchesSearch, vip = false) {
  return queryOptions({
    queryKey: matchKeys.list(search, vip),
    queryFn: ({ signal }): Promise<MatchPage> =>
      unwrap(
        api.GET("/api/v1/matches", {
          params: { query: toMatchesQuery(search, vip) },
          signal,
        })
      ),
    // Al cambiar de página o de filtro, la tabla anterior queda hasta que llega la nueva.
    placeholderData: keepPreviousData,
    refetchInterval: MIXES_REFRESH_MS,
  })
}

/** Marcar (VIP) o sacar una favorita. La estrella cambia al instante y vuelve si falla. */
export function useFavorite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const params = { params: { path: { id } } }
      await unwrap(
        on
          ? api.PUT("/api/v1/me/favorites/{id}", params)
          : api.DELETE("/api/v1/me/favorites/{id}", params)
      )
    },
    onMutate: async ({ id, on }) => {
      await queryClient.cancelQueries({ queryKey: LISTS })
      const before = queryClient.getQueriesData<MatchPage>({ queryKey: LISTS })
      queryClient.setQueriesData<MatchPage>(
        { queryKey: LISTS },
        (page) =>
          page && {
            ...page,
            items: page.items.map((m) =>
              m.id === id ? { ...m, favorite: on } : m
            ),
          }
      )
      return { before }
    },
    onError: (_e, _v, ctx) =>
      ctx?.before.forEach(([key, page]) => queryClient.setQueryData(key, page)),
    // Con el filtro Favoritas, la que se saca tiene que irse de la lista.
    onSettled: () => queryClient.invalidateQueries({ queryKey: LISTS }),
  })
}
