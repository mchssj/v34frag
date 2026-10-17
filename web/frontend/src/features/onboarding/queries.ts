import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { myProfileOptions } from "@/features/profile/queries"

export type SteamStatus = Schemas["MySteamStatus"]
export type MyProfile = Schemas["MyProfile"]

export const claimKeys = {
  status: ["claim", "status"] as const,
}

export const steamStatusOptions = queryOptions({
  queryKey: claimKeys.status,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/me/claim-code", { signal })),
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

export type OnboardingStatus = {
  /** Puesto preferido (game_role) elegido */
  style: boolean
  /** Al menos un SteamID vinculado */
  linked: boolean
  done: number
  complete: boolean
}

export function onboardingFrom(
  profile: MyProfile,
  steam: SteamStatus
): OnboardingStatus {
  const style = Boolean(profile.details?.game_role)
  const linked = steam.steam_ids.length > 0
  const done = Number(style) + Number(linked)
  return { style, linked, done, complete: done === 2 }
}

export function useOnboardingStatus(): OnboardingStatus | null {
  const profile = useQuery(myProfileOptions)
  const steam = useQuery(steamStatusOptions)
  if (!profile.data || !steam.data) return null
  return onboardingFrom(profile.data, steam.data)
}

// Provisorio hasta que /auth/me traiga onboarding_done: la Bienvenida se muestra una sola vez
// por cuenta en este navegador; después queda el aviso del Home.
const seenKey = (userId: string) => `csstv.welcome-seen.${userId}`

export function markWelcomeSeen(userId: string) {
  try {
    localStorage.setItem(seenKey(userId), "1")
  } catch {
    // Sin storage: se volvería a mostrar en el próximo login.
  }
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
