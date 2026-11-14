import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { profileKeys } from "@/features/profile/api/queries"

// Tienda (replanteo 113, contrato docs/frontend/contrato/tienda.md). El catálogo entero (333 artículos) se pide
// de una vez: la tienda filtra, cuenta y ordena al instante, como el prototipo de Kyan.

export const shopKeys = {
  all: ["shop"] as const,
  catalog: (user: string | null) => ["shop", "catalog", user] as const,
  config: ["shop", "config"] as const,
  points: ["shop", "points"] as const,
  history: (currency: "points" | "vip", page: number) =>
    ["shop", "history", currency, page] as const,
  equipped: ["shop", "equipped"] as const,
  players: (ids: string[]) => ["shop", "players", ids] as const,
  admin: ["shop", "admin"] as const,
}

/** `user`: el id de la cuenta (o null sin sesión): con sesión, cada artículo dice si es tuyo. */
export const catalogOptions = (user: string | null) =>
  queryOptions({
    queryKey: shopKeys.catalog(user),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/shop/items", {
          params: { query: { per: 400, sort: "sort", order: "asc" } },
          signal,
        })
      ),
    staleTime: 60_000,
  })

export const configOptions = queryOptions({
  queryKey: shopKeys.config,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/shop/config", { signal })),
  staleTime: 5 * 60_000,
})

export const pointsOptions = queryOptions({
  queryKey: shopKeys.points,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/me/points", { signal })),
})

export const historyOptions = (currency: "points" | "vip", page: number) =>
  queryOptions({
    queryKey: shopKeys.history(currency, page),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/me/points/history", {
          params: { query: { currency, page, per: 20 } },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })

export const equippedOptions = queryOptions({
  queryKey: shopKeys.equipped,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/me/cosmetics", { signal })),
})

/** Lo equipado de varias fichas (la sala del matchmaking, los amigos): hasta 100 por pedido. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const playersCosmeticsOptions = (ids: string[]) => {
  // Solo ids de fichas reales (la API rechaza los demás; la demo del matchmaking usa "p-maxi" y no pide nada).
  const sorted = [...new Set(ids.filter((id) => UUID.test(id)))]
    .sort()
    .slice(0, 100)
  return queryOptions({
    queryKey: shopKeys.players(sorted),
    enabled: sorted.length > 0,
    queryFn: async ({ signal }) => {
      const r = await unwrap(
        api.GET("/api/v1/cosmetics", {
          params: { query: { players: sorted.join(",") } },
          signal,
        })
      )
      return new Map(r.items.map((i) => [i.player_id, i]))
    },
    staleTime: 5 * 60_000,
    // Es decoración: si falla (o no hay API, como en la demo del matchmaking), no se reintenta y no se muestra.
    retry: false,
  })
}

/** Después de comprar o equipar: el catálogo, el saldo, lo equipado y la ficha propia cambian. */
function useRefreshShop() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: shopKeys.all })
    void qc.invalidateQueries({ queryKey: ["public-player"] })
  }
}

export function useBuy() {
  const refresh = useRefreshShop()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST("/api/v1/shop/items/{id}/buy", { params: { path: { id } } })
      ),
    onSuccess: refresh,
  })
}

export function useEquip() {
  const qc = useQueryClient()
  const refresh = useRefreshShop()
  return useMutation({
    mutationFn: (body: Schemas["EquipPatch"]) =>
      unwrap(api.PUT("/api/v1/me/cosmetics", { body })),
    onSuccess: (equipped) => {
      qc.setQueryData(shopKeys.equipped, equipped)
      refresh()
    },
  })
}

export function useUploadCover() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (blob: Blob) =>
      unwrap(
        api.POST("/api/v1/me/cover", {
          // El schema tipa `file` como string (binary); se arma el multipart a mano.
          body: { file: "" },
          bodySerializer: () => {
            const form = new FormData()
            form.append("file", blob, "portada.jpg")
            return form
          },
        })
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKeys.mine })
      void qc.invalidateQueries({ queryKey: ["public-player"] })
    },
  })
}

export function useDeleteCover() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => unwrap(api.DELETE("/api/v1/me/cover")),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKeys.mine })
      void qc.invalidateQueries({ queryKey: ["public-player"] })
    },
  })
}

// ---------- lo propio (bitácoras 2026-11-13-avatar-y-fondo-propios y 2026-11-14-inventario-de-lo-propio) ----------

export const customOptions = queryOptions({
  queryKey: ["shop", "custom"] as const,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/me/custom", { signal })),
})

export type CustomUploadInput = {
  kind: "avatar" | "background"
  file: Blob
  name: string
  price: number
  animated: boolean
  /** Lo animado se recorta en el servidor: el recuadro en píxeles del original. */
  crop?: { x: number; y: number; width: number; height: number }
}

/** Sube lo propio: cobra, lo guarda, se lo pone y avisa con el saldo nuevo. Recarga la tienda y la ficha. */
export function useUploadCustom() {
  const refresh = useRefreshShop()
  return useMutation({
    mutationFn: (v: CustomUploadInput) =>
      unwrap(
        api.POST("/api/v1/me/custom/{kind}", {
          params: { path: { kind: v.kind } },
          // El schema tipa `file` como string (binary); se arma el multipart a mano.
          body: {} as never,
          bodySerializer: () => {
            const form = new FormData()
            form.append("file", v.file, v.name)
            form.append("price", String(v.price))
            form.append("rights", "true")
            if (v.kind === "background")
              form.append("animated", String(v.animated))
            if (v.crop) {
              form.append("crop_x", String(Math.round(v.crop.x)))
              form.append("crop_y", String(Math.round(v.crop.y)))
              form.append("crop_w", String(Math.round(v.crop.width)))
              form.append("crop_h", String(Math.round(v.crop.height)))
            }
            return form
          },
        })
      ),
    onSuccess: refresh,
  })
}

/** Borra una subida guardada (puesta o no). */
export function useDeleteCustom() {
  const refresh = useRefreshShop()
  return useMutation({
    mutationFn: (cid: string) =>
      unwrap(
        api.DELETE("/api/v1/me/custom/items/{cid}", {
          params: { path: { cid } },
        })
      ),
    onSuccess: refresh,
  })
}

/** Denunciar el avatar, el fondo o la portada de un perfil. */
export function useReportMedia() {
  return useMutation({
    mutationFn: (v: { player: string; body: Schemas["MediaReportBody"] }) =>
      unwrap(
        api.POST("/api/v1/players/{id}/media-reports", {
          params: { path: { id: v.player } },
          body: v.body,
        })
      ),
  })
}

// ---------- admin ----------

type Paths = import("@/api/schema").paths
export type AdminItemQuery = NonNullable<
  Paths["/api/v1/admin/shop/items"]["get"]["parameters"]["query"]
>
export type AdminAccountQuery = NonNullable<
  Paths["/api/v1/admin/points/accounts"]["get"]["parameters"]["query"]
>

export const adminItemsOptions = (query: AdminItemQuery) =>
  queryOptions({
    queryKey: [...shopKeys.admin, "items", query] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/shop/items", { params: { query }, signal })
      ),
    placeholderData: keepPreviousData,
  })

export const adminAccountsOptions = (query: AdminAccountQuery) =>
  queryOptions({
    queryKey: [...shopKeys.admin, "accounts", query] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/points/accounts", { params: { query }, signal })
      ),
    placeholderData: keepPreviousData,
  })

export const adminConfigOptions = queryOptions({
  queryKey: [...shopKeys.admin, "config"] as const,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/admin/points/config", { signal })),
})

export const adminUserItemsOptions = (id: string) =>
  queryOptions({
    queryKey: [...shopKeys.admin, "user-items", id] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/users/{id}/items", {
          params: { path: { id }, query: { per: 100 } },
          signal,
        })
      ),
  })

/** Toda acción del admin cambia saldos o el catálogo de alguien: se recarga todo lo de la tienda. */
function useAdminMutation<T, R>(fn: (v: T) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: shopKeys.all }),
  })
}

export const useAdminPatchItem = () =>
  useAdminMutation((v: { id: string; body: Schemas["AdminShopItemPatch"] }) =>
    unwrap(
      api.PATCH("/api/v1/admin/shop/items/{id}", {
        params: { path: { id: v.id } },
        body: v.body,
      })
    )
  )

export const useAdminConfig = () =>
  useAdminMutation((body: Schemas["PointsConfigPatch"]) =>
    unwrap(api.PUT("/api/v1/admin/points/config", { body }))
  )

export const useAdminGrant = () =>
  useAdminMutation((v: { id: string; body: Schemas["PointsGrant"] }) =>
    unwrap(
      api.POST("/api/v1/admin/users/{id}/points", {
        params: { path: { id: v.id } },
        body: v.body,
      })
    )
  )

export const useAdminItemGrant = () =>
  useAdminMutation((v: { id: string; body: Schemas["ItemGrant"] }) =>
    unwrap(
      api.POST("/api/v1/admin/users/{id}/items", {
        params: { path: { id: v.id } },
        body: v.body,
      })
    )
  )

export const useAdminItemRevoke = () =>
  useAdminMutation((v: { id: string; item: string; reason: string }) =>
    unwrap(
      api.POST("/api/v1/admin/users/{id}/items/{item}/revoke", {
        params: { path: { id: v.id, item: v.item } },
        body: { reason: v.reason },
      })
    )
  )

export const useAdminCoverClear = () =>
  useAdminMutation((v: { id: string; reason: string }) =>
    unwrap(
      api.POST("/api/v1/admin/users/{id}/cover/clear", {
        params: { path: { id: v.id } },
        body: { reason: v.reason },
      })
    )
  )

export const adminUserCustomOptions = (id: string) =>
  queryOptions({
    queryKey: [...shopKeys.admin, "user-custom", id] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/users/{id}/custom", {
          params: { path: { id } },
          signal,
        })
      ),
  })

export const useAdminCustomClear = () =>
  useAdminMutation((v: { id: string; cid: string; reason: string }) =>
    unwrap(
      api.POST("/api/v1/admin/users/{id}/custom/items/{cid}/clear", {
        params: { path: { id: v.id, cid: v.cid } },
        body: { reason: v.reason },
      })
    )
  )

// ---------- denuncias de imágenes (moderadores y admins) ----------

export type MediaReportQuery = NonNullable<
  Paths["/api/v1/admin/profile-media-reports"]["get"]["parameters"]["query"]
>

export const mediaReportsOptions = (query: MediaReportQuery) =>
  queryOptions({
    queryKey: ["media-reports", query] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/profile-media-reports", {
          params: { query },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })

export function useResolveMediaReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; action: "dismiss" | "remove" }) =>
      unwrap(
        api.POST("/api/v1/admin/profile-media-reports/{id}/resolve", {
          params: { path: { id: v.id } },
          body: { action: v.action },
        })
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["media-reports"] })
      void qc.invalidateQueries({ queryKey: ["public-player"] })
    },
  })
}
