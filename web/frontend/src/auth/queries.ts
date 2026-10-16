import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { ApiError, isApiError } from "@/api/errors"
import { env } from "@/lib/env"
import type { LoginValues, SignupValues } from "./schemas"
import { toSession, tokenStore } from "./tokenStore"

export type AuthUser = Schemas["AuthUser"]
// Provisorio: el contrato agrega "organizer"; sale del schema al regenerar con el backend nuevo.
export type Role = AuthUser["role"] | "organizer"

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

function missingSession() {
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

export type AliasReason = "length" | "chars" | "blocked" | "taken"
export type AliasAvailability = {
  available: boolean
  reason: AliasReason | null
}

// Provisorio: GET /api/v1/aliases/{alias}/available todavía no está en la rama del backend.
// Al regenerar el schema, reemplazar el fetch por api.GET. Un 404 devuelve null (sin verificar).
export function aliasAvailabilityOptions(alias: string) {
  const value = alias.trim()
  return queryOptions({
    queryKey: authKeys.alias(value.toLowerCase()),
    queryFn: async ({ signal }): Promise<AliasAvailability | null> => {
      const res = await fetch(
        `${env.apiUrl}/api/v1/aliases/${encodeURIComponent(value)}/available`,
        { signal }
      )
      if (res.status === 404) return null
      if (!res.ok)
        throw new ApiError({
          status: res.status,
          code: "INTERNAL",
          message: "",
        })
      const body = (await res.json()) as Partial<AliasAvailability>
      return { available: body.available === true, reason: body.reason ?? null }
    },
    staleTime: 30_000,
    retry: false,
  })
}
