import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import { api, unwrap, type Schemas } from "@/api/client"
import { errorMessage } from "@/api/errors"
import type { CommentReportReason } from "@/features/player/components/CommentReportDialog"

// Tierlists (replanteo 137, bitácora 2026-11-22-tierlists-jugadores-equipos): consultas y acciones contra la API.

export type Tierlist = Schemas["Tierlist"]
export type TierlistComments = Schemas["TierlistComments"]
export type TierlistComment = TierlistComments["items"][number]

export const tierlistKey = (id: string) => ["tierlists", id] as const
const commentsKey = (id: string) => ["tierlists", id, "comments"] as const
const ofPlayerKey = (playerId: string) =>
  ["players", playerId, "tierlists"] as const

export const tierlistsOfOptions = (playerId: string) =>
  queryOptions({
    queryKey: ofPlayerKey(playerId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/players/{id}/tierlists", {
          params: { path: { id: playerId } },
          signal,
        })
      ),
  })

export const tierlistOptions = (id: string) =>
  queryOptions({
    queryKey: tierlistKey(id),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/tierlists/{id}", { params: { path: { id } }, signal })
      ),
  })

export const tierlistCommentsOptions = (id: string) =>
  queryOptions({
    queryKey: commentsKey(id),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/tierlists/{id}/comments", {
          params: { path: { id } },
          signal,
        })
      ),
  })

export const fetchOlderComments = (id: string, before: string) =>
  unwrap(
    api.GET("/api/v1/tierlists/{id}/comments", {
      params: { path: { id }, query: { before } },
    })
  )

/** Buscador del editor: fichas o equipos oficiales que coinciden con el texto. */
export const pickerOptions = (kind: Tierlist["kind"], q: string) =>
  queryOptions({
    queryKey: ["tierlists", "picker", kind, q],
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      if (kind === "players") {
        const r = await unwrap(
          api.GET("/api/v1/players", {
            params: { query: { q, per: 8, page: 1 } },
            signal,
          })
        )
        return r.items.map((p) => ({
          kind: "player" as const,
          id: p.id,
          name: p.alias,
          tag: null,
          image_url: p.photo_url,
        }))
      }
      const r = await unwrap(
        api.GET("/api/v1/teams", {
          params: { query: { q, per: 8, page: 1, kind: "official" } },
          signal,
        })
      )
      return r.items.map((t) => ({
        kind: "team" as const,
        id: t.id,
        name: t.name,
        tag: t.tag,
        image_url: t.logo_url,
      }))
    },
  })

const onError = (e: unknown) => toast.error(errorMessage(e))

/** Las acciones de una tierlist; cada una deja los datos nuevos en la caché. */
export function useTierlistActions(id: string) {
  const qc = useQueryClient()
  const set = (t: Tierlist) => {
    qc.setQueryData(tierlistKey(id), t)
    void qc.invalidateQueries({
      queryKey: ["players", t.owner.player_id, "tierlists"],
    })
  }
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: tierlistKey(id) })
    void qc.invalidateQueries({
      queryKey: ["players"],
      predicate: (q) => q.queryKey[2] === "tierlists",
    })
  }
  const setComments = (c: TierlistComments) =>
    qc.setQueryData(commentsKey(id), c)

  const save = useMutation({
    mutationFn: (body: Schemas["TierlistSave"]) =>
      unwrap(
        api.PUT("/api/v1/tierlists/{id}", { params: { path: { id } }, body })
      ),
    onSuccess: (t) => {
      set(t)
      toast.success("Tierlist guardada")
    },
    onError,
  })
  const like = useMutation({
    mutationFn: (on: boolean) =>
      unwrap(
        api.PUT("/api/v1/tierlists/{id}/like", {
          params: { path: { id } },
          body: { on },
        })
      ),
    onSuccess: set,
    onError,
  })
  const feature = useMutation({
    mutationFn: async (on: boolean) => {
      await unwrap(
        api.PUT("/api/v1/tierlists/{id}/featured", {
          params: { path: { id } },
          body: { on },
        })
      )
    },
    onSuccess: refresh,
    onError,
  })
  const setOpen = useMutation({
    mutationFn: async (open: boolean) => {
      await unwrap(
        api.PUT("/api/v1/tierlists/{id}/comments-open", {
          params: { path: { id } },
          body: { open },
        })
      )
    },
    onSuccess: () => {
      refresh()
      void qc.invalidateQueries({ queryKey: commentsKey(id) })
    },
    onError,
  })
  const remove = useMutation({
    mutationFn: async () => {
      await unwrap(
        api.DELETE("/api/v1/tierlists/{id}", { params: { path: { id } } })
      )
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: tierlistKey(id) })
      refresh()
      toast.success("Tierlist borrada")
    },
    onError,
  })
  const copy = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/v1/tierlists/{id}/copy", { params: { path: { id } } })
      ),
    onSuccess: () => toast.success("Tierlist copiada: ya es tuya para editar"),
    onError,
  })
  const comment = useMutation({
    mutationFn: (v: { body: string; parent_id?: string }) =>
      unwrap(
        api.POST("/api/v1/tierlists/{id}/comments", {
          params: { path: { id } },
          body: v,
        })
      ),
    onSuccess: setComments,
    onError,
  })
  const removeComment = useMutation({
    mutationFn: async (commentId: string) => {
      await unwrap(
        api.DELETE("/api/v1/tierlist-comments/{id}", {
          params: { path: { id: commentId } },
        })
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: commentsKey(id) }),
    onError,
  })
  const report = useMutation({
    mutationFn: async (v: {
      reason: CommentReportReason
      note: string
      comment_id?: string
    }) => {
      await unwrap(
        api.POST("/api/v1/tierlists/{id}/report", {
          params: { path: { id } },
          body: {
            reason: v.reason,
            note: v.note || undefined,
            comment_id: v.comment_id,
          },
        })
      )
    },
    onSuccess: () =>
      toast.success("Denuncia enviada", {
        description: "Un moderador la va a revisar.",
      }),
    onError,
  })
  return {
    save,
    like,
    feature,
    setOpen,
    remove,
    copy,
    comment,
    removeComment,
    report,
  }
}

export function useCreateTierlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Schemas["TierlistCreate"]) =>
      unwrap(api.POST("/api/v1/tierlists", { body })),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["players"],
        predicate: (q) => q.queryKey[2] === "tierlists",
      }),
    onError,
  })
}
