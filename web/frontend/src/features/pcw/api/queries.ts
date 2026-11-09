import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"

// La página de PCW contra la API (bitácora 2026-11-08-pcw-real). Las acciones vuelven a pedir lo que cambió.

export const pcwKeys = {
  all: ["pcw"] as const,
  posts: ["pcw", "posts"] as const,
  myPost: ["pcw", "my-post"] as const,
  myMatches: ["pcw", "my-matches"] as const,
  context: ["pcw", "context"] as const,
  results: ["pcw", "results"] as const,
  formats: ["pcw", "formats"] as const,
  servers: ["pcw", "servers"] as const,
}

/** El tablón cambia con las ofertas de los demás: se refresca cada 20 s. */
const BOARD_MS = 20_000

export const pcwPostsOptions = queryOptions({
  queryKey: pcwKeys.posts,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/pcw/posts", {
          params: { query: { per: 100, sort: "created_at", order: "desc" } },
          signal,
        })
      )
    ).items,
  refetchInterval: BOARD_MS,
})

export const myPcwPostOptions = queryOptions({
  queryKey: pcwKeys.myPost,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/me/pcw/post", { signal })),
  refetchInterval: BOARD_MS,
})

/** Las próximas y las últimas: las 50 más nuevas por hora. Con una reserva abierta se refresca cada 10 s. */
export const myPcwMatchesOptions = queryOptions({
  queryKey: pcwKeys.myMatches,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/me/pcw/matches", {
          params: { query: { per: 50, sort: "starts_at", order: "desc" } },
          signal,
        })
      )
    ).items,
  refetchInterval: (q) =>
    q.state.data?.some((m) => m.booking) ? 10_000 : BOARD_MS,
})

export const pcwContextOptions = queryOptions({
  queryKey: pcwKeys.context,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/me/pcw/context", { signal })),
  staleTime: 60_000,
})

/** Las últimas PCW jugadas de todos: la actividad del costado. */
export const pcwResultsOptions = queryOptions({
  queryKey: pcwKeys.results,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/matches", {
          params: {
            query: {
              kind: "pcw",
              status: "finished",
              per: 20,
              sort: "played_at",
              order: "desc",
            },
          },
          signal,
        })
      )
    ).items,
  staleTime: 60_000,
})

export const pcwFormatsOptions = queryOptions({
  queryKey: pcwKeys.formats,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/pcw/formats", { signal })),
  staleTime: 10 * 60_000,
})

/** Servidores libres y aptos para PCW. */
export const pcwServersOptions = queryOptions({
  queryKey: pcwKeys.servers,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/servers/free", {
          params: { query: { kind: "pcw", per: 100 } },
          signal,
        })
      )
    ).items,
  refetchInterval: 30_000,
})

function usePcwMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: pcwKeys.all }),
  })
}

export type PublishBody = {
  best_of: 1 | 3 | 5
  starts_at?: string
  note?: string
  map_pool?: string[] | null
  team_id?: string
  name?: string
  players: string[]
  guests: string[]
}

export const usePublishPcw = () =>
  usePcwMutation((body: PublishBody) =>
    unwrap(api.POST("/api/v1/pcw/posts", { body }))
  )

export const useCancelPcwPost = () =>
  usePcwMutation((id: string) =>
    unwrap(api.DELETE("/api/v1/pcw/posts/{id}", { params: { path: { id } } }))
  )

export type OfferBody = Omit<PublishBody, "best_of" | "note" | "map_pool">

export const useSendOffer = () =>
  usePcwMutation(({ postId, body }: { postId: string; body: OfferBody }) =>
    unwrap(
      api.POST("/api/v1/pcw/posts/{id}/offers", {
        params: { path: { id: postId } },
        body,
      })
    )
  )

export const useWithdrawOffer = () =>
  usePcwMutation((id: string) =>
    unwrap(api.DELETE("/api/v1/pcw/offers/{id}", { params: { path: { id } } }))
  )

export const useChooseOffer = () =>
  usePcwMutation((id: string) =>
    unwrap(
      api.POST("/api/v1/pcw/offers/{id}/choose", { params: { path: { id } } })
    )
  )

export const useCancelPcwMatch = () =>
  usePcwMutation((id: string) =>
    unwrap(
      api.POST("/api/v1/pcw/matches/{id}/cancel", { params: { path: { id } } })
    )
  )

/** "Estamos listos" y "Ya no estamos listos" (replanteo 56). */
export const usePcwReady = () =>
  usePcwMutation(({ id, ready }: { id: string; ready: boolean }) =>
    ready
      ? unwrap(
          api.POST("/api/v1/matches/{id}/ready", { params: { path: { id } } })
        )
      : unwrap(
          api.DELETE("/api/v1/matches/{id}/ready", { params: { path: { id } } })
        )
  )
