import type { Schemas } from "@/api/client"

// Tipos del módulo (los de la API y los propios).

export type SteamStatus = Schemas["MySteamStatus"]

export type MyProfile = Schemas["MyProfile"]

export type WelcomeStep = "photo" | "style" | "contacts" | "link"

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
