import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { myProfileOptions } from "@/features/profile/api/queries"
import type { OnboardingStatus } from "../types"
import { onboardingFrom, seenKey } from "../lib/onboarding"

export const claimKeys = {
  status: ["claim", "status"] as const,
  requests: ["claim", "requests"] as const,
}

export const steamStatusOptions = queryOptions({
  queryKey: claimKeys.status,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/me/claim-code", { signal })),
})

/** Mis solicitudes de SteamID adicional (`kind: add`) esperando que las apruebe un admin. */
export const mySteamRequestsOptions = queryOptions({
  queryKey: claimKeys.requests,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/me/steam-requests", {
          params: { query: { status: "pending", kind: "add", per: 100 } },
          signal,
        })
      )
    ).items,
})

/** Pide un código nuevo (hasta 5 por hora: se reutiliza el vigente si existe). */
export function useCreateClaimCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/me/claim-code")),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: claimKeys.status }),
  })
}

/** Elige el SteamID principal (sin aprobación, una vez cada 24 horas). */
export function useMakePrimary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (steamid: string) =>
      unwrap(
        api.POST("/api/v1/me/steam/{steamid}/primary", {
          params: { path: { steamid } },
        })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: claimKeys.status }),
  })
}

/** Pide desvincular un SteamID; queda pendiente hasta que lo apruebe un admin. */
export function useRequestUnlink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ steamid, reason }: { steamid: string; reason: string }) =>
      unwrap(
        api.POST("/api/v1/me/steam/{steamid}/unlink", {
          params: { path: { steamid } },
          // Sin motivo no se manda la clave.
          body: reason.trim() ? { reason: reason.trim() } : {},
        })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: claimKeys.status }),
  })
}

/** Cancela el pedido de desvincular mientras siga pendiente: el SteamID queda en la ficha. */
export function useCancelUnlink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (steamid: string) =>
      unwrap(
        api.DELETE("/api/v1/me/steam/{steamid}/unlink", {
          params: { path: { steamid } },
        })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: claimKeys.status }),
  })
}

export function useOnboardingStatus(): OnboardingStatus | null {
  const profile = useQuery(myProfileOptions)
  const steam = useQuery(steamStatusOptions)
  if (!profile.data || !steam.data) return null
  return onboardingFrom(profile.data, steam.data)
}

function welcomeSeen(userId: string) {
  try {
    return localStorage.getItem(seenKey(userId)) === "1"
  } catch {
    return false
  }
}

/** Después del login: ¿hay que pasar por /welcome? Ante un error, no se interrumpe el ingreso. */
export async function needsWelcome(
  queryClient: QueryClient,
  userId: string
): Promise<boolean> {
  if (welcomeSeen(userId)) return false
  try {
    const [profile, steam] = await Promise.all([
      queryClient.ensureQueryData(myProfileOptions),
      queryClient.ensureQueryData(steamStatusOptions),
    ])
    return !onboardingFrom(profile, steam).complete
  } catch {
    return false
  }
}
