import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { ApiError, isApiError } from "@/api/errors"
import type { LoginValues, SignupValues } from "./schemas"
import { toSession, tokenStore } from "./tokenStore"

export type AuthUser = Schemas["AuthUser"]
export type Role = AuthUser["role"]

export const authKeys = {
  me: ["auth", "me"] as const,
  alias: (alias: string) => ["auth", "alias", alias] as const,
}

export const meQueryOptions = queryOptions({
  queryKey: authKeys.me,
  queryFn: async ({ signal }): Promise<AuthUser | null> => {
    // Sin sesión no se llama a la API (ensureQueryData ignora `enabled`).
    if (!tokenStore.getState().session) return null
    try {
      return await unwrap(api.GET("/auth/me", { signal }))
    } catch (e) {
      if (!isApiError(e, "UNAUTHORIZED")) throw e
      // 401 después de renovar: la cuenta ya no es válida.
      if (tokenStore.getState().session) tokenStore.logout()
      return null
    }
  },
  staleTime: 5 * 60_000,
  retry: (failures, e) =>
    failures < 1 &&
    (isApiError(e, "NETWORK") || (isApiError(e) && e.status >= 500)),
})

export function useMe() {
  return useQuery(meQueryOptions)
}

export function missingSession() {
  return new ApiError({
    status: 500,
    code: "INTERNAL",
    message: "La API no devolvió la sesión.",
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, password, remember }: LoginValues) => {
      const session = await unwrap(
        api.POST("/auth/login", { body: { email, password } })
      )
      if (!session) throw missingSession()
      // Primero el usuario y después la sesión: AuthSync no vuelve a pedir /auth/me.
      queryClient.setQueryData(authKeys.me, session.user)
      tokenStore.setSession(toSession(session), remember)
      return session.user
    },
  })
}

export function useSignup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, password, tag }: SignupValues) => {
      const result = await unwrap(
        api.POST("/auth/signup", { body: { email, password, tag } })
      )
      if (result.session) {
        queryClient.setQueryData(authKeys.me, result.session.user)
        tokenStore.setSession(toSession(result.session), true)
      }
      return result
    },
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      try {
        await unwrap(api.POST("/auth/logout"))
      } catch {
        // Si la API no responde, la sesión se cierra igual en el navegador.
      } finally {
        tokenStore.logout()
      }
    },
  })
}

export type AliasAvailability = Schemas["AliasAvailability"]
export type AliasReason = NonNullable<AliasAvailability["reason"]>

/** Disponibilidad del alias. Con sesión, el alias propio cuenta como libre. */
export function aliasAvailabilityOptions(alias: string) {
  const value = alias.trim()
  return queryOptions({
    // Sin distinguir mayúsculas, igual que la unicidad en la base.
    queryKey: authKeys.alias(value.toLowerCase()),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/aliases/{alias}/available", {
          params: { path: { alias: value } },
          signal,
        })
      ),
    staleTime: 30_000,
    retry: false,
  })
}
