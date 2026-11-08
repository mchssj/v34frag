import { queryOptions, useQueries } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import type { Schemas } from "@/api/client"

type Clip = Schemas["Clip"]

/** Clips de un mapa de la serie (el mix vinculado). Mientras alguno se graba, se vuelve a pedir. */
export function gameClipsOptions(gameId: string) {
  return queryOptions({
    queryKey: ["series", "clips", gameId] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/matches/{id}/clips", {
          params: { path: { id: gameId }, query: { per: 50 } },
          signal,
        })
      ),
    refetchInterval: (q) =>
      q.state.data?.items.some((c) =>
        ["pending", "processing"].includes(c.video.status)
      )
        ? 60_000
        : false,
  })
}

/** Los clips de todos los mapas, por id de juego. */
export function useSeriesClips(gameIds: string[]) {
  return useQueries({
    queries: gameIds.map((id) => gameClipsOptions(id)),
    combine: (rs) => ({
      byGame: new Map<string, Clip[]>(
        rs.flatMap((r, i) => (r.data ? [[gameIds[i], r.data.items]] : []))
      ),
      pending: rs.some((r) => r.isPending),
    }),
  })
}
