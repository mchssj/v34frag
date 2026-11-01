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

export type WelcomeStep = "photo" | "style" | "contacts" | "link"
const ORDER: WelcomeStep[] = ["photo", "style", "contacts", "link"]

export type OnboardingStatus = {
  /** Foto o nombre real cargados, o el paso guardado (aunque sea vacío) */
  photo: boolean
  /** Puesto preferido (game_role) elegido */
  style: boolean
  /** Algún contacto cargado, o el paso guardado (aunque sea vacío) */
  contacts: boolean
  /** Al menos un SteamID vinculado */
  linked: boolean
  done: number
  complete: boolean
}

// Provisorio hasta que /auth/me traiga el progreso por paso: Foto y Contactos son opcionales y
// "Guardar y seguir" con todo vacío cuenta como hecho. Se recuerda por cuenta en este navegador.
const savedKey = (userId: string) => `csstv.onboarding.${userId}`

function savedSteps(userId: string): WelcomeStep[] {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(savedKey(userId)) ?? "[]"
    )
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

export function markStepSaved(userId: string, step: "photo" | "contacts") {
  try {
    const steps = new Set([...savedSteps(userId), step])
    localStorage.setItem(savedKey(userId), JSON.stringify([...steps]))
  } catch {
    // Sin storage: el paso vuelve a aparecer como pendiente.
  }
}

export function onboardingFrom(
  profile: MyProfile,
  steam: SteamStatus
): OnboardingStatus {
  const d = profile.details
  const saved = savedSteps(profile.user.id)
  const photo =
    Boolean(d?.avatar_url || d?.real_name) || saved.includes("photo")
  const style = Boolean(d?.game_role)
  const contacts =
    Boolean(d?.discord || d?.steam || d?.faceit) || saved.includes("contacts")
  const linked = steam.steam_ids.length > 0
  const done = [photo, style, contacts, linked].filter(Boolean).length
  return { photo, style, contacts, linked, done, complete: done === 4 }
}

const isDone = (status: OnboardingStatus, step: WelcomeStep) =>
  step === "link" ? status.linked : status[step]

/**
 * Pasos de la Bienvenida: solo los que faltan, en orden. Si no falta ninguno (entró por la URL),
 * los tres editables.
 */
export function welcomeSteps(status: OnboardingStatus): WelcomeStep[] {
  const pending = ORDER.filter((step) => !isDone(status, step))
  return pending.length ? pending : ["photo", "style", "contacts"]
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
