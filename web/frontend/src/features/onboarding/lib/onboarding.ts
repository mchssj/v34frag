import type {
  SteamStatus,
  MyProfile,
  WelcomeStep,
  OnboardingStatus,
} from "../types"

const ORDER: WelcomeStep[] = ["photo", "style", "contacts", "link"]

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

// Provisorio hasta que /auth/me traiga onboarding_done: la Bienvenida se muestra una sola vez
// por cuenta en este navegador; después queda el aviso del Home.
export const seenKey = (userId: string) => `csstv.welcome-seen.${userId}`

export function markWelcomeSeen(userId: string) {
  try {
    localStorage.setItem(seenKey(userId), "1")
  } catch {
    // Sin storage: se volvería a mostrar en el próximo login.
  }
}
