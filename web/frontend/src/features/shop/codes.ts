import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"

import { shopKeys } from "./api"

// Códigos canjeables para sorteos (replanteo 126, bitácora 2026-11-16-codigos-canjeables). Las reglas (usos,
// vencimiento, una vez por cuenta, topes de intentos) las aplica la base.

export type AdminCode = Schemas["AdminCode"]
type Paths = import("@/api/schema").paths
export type AdminCodeQuery = NonNullable<
  Paths["/api/v1/admin/codes"]["get"]["parameters"]["query"]
>

// ---------- API ----------

const codeKeys = {
  mine: [...shopKeys.all, "redemptions"] as const,
  admin: [...shopKeys.admin, "codes"] as const,
}

export const myRedemptionsOptions = queryOptions({
  queryKey: codeKeys.mine,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/me/redemptions", { signal })),
})

/** Canjear: cambian el saldo, el catálogo, el VIP (viene en el saldo) y lo que se ve en la ficha. */
export function useRedeem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      unwrap(api.POST("/api/v1/me/redeem", { body: { code } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shopKeys.all })
      void qc.invalidateQueries({ queryKey: ["public-player"] })
    },
  })
}

export const adminCodesOptions = (query: AdminCodeQuery) =>
  queryOptions({
    queryKey: [...codeKeys.admin, "list", query] as const,
    queryFn: ({ signal }) =>
      unwrap(api.GET("/api/v1/admin/codes", { params: { query }, signal })),
    placeholderData: keepPreviousData,
  })

export const adminRedemptionsOptions = (id: string) =>
  queryOptions({
    queryKey: [...codeKeys.admin, "redemptions", id] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/codes/{id}/redemptions", {
          params: { path: { id } },
          signal,
        })
      ),
  })

export const adminAttemptsOptions = queryOptions({
  queryKey: [...codeKeys.admin, "attempts"] as const,
  queryFn: ({ signal }) =>
    unwrap(
      api.GET("/api/v1/admin/codes/attempts", {
        params: { query: { limit: 50 } },
        signal,
      })
    ),
})

function useCodesMutation<T, R>(fn: (v: T) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: shopKeys.all }),
  })
}

export const useCreateCodes = () =>
  useCodesMutation((body: Schemas["CodeCreate"]) =>
    unwrap(api.POST("/api/v1/admin/codes", { body }))
  )

export const useRevokeCode = () =>
  useCodesMutation((v: { id: string; reason: string }) =>
    unwrap(
      api.POST("/api/v1/admin/codes/{id}/revoke", {
        params: { path: { id: v.id } },
        body: { reason: v.reason },
      })
    )
  )

export const useRevertRedemption = () =>
  useCodesMutation((v: { id: string; reason: string }) =>
    unwrap(
      api.POST("/api/v1/admin/redemptions/{id}/revert", {
        params: { path: { id: v.id } },
        body: { reason: v.reason },
      })
    )
  )
