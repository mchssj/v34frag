import type { Schemas } from "@/api/client"

export type AdminMedal = Schemas["AdminMedal"]
export type GrantBody = Schemas["MedalGrantBody"]
export type MedalPatch = Schemas["MedalPatchBody"]
export type MedalRule = Schemas["MedalRule"]
export type RulePatch = Schemas["MedalRulePatch"]
export type Season = Schemas["Season"]

/** Jugador elegido para darle una medalla. */
export type Pick = { id: string; alias: string; photo_url: string | null }

/** Filtros de "Otorgadas". `season`: id, "none" (de carrera) o vacío (todas). */
export type GrantedFilter = {
  q?: string
  season?: string
  source?: "admin" | "auto" | "temporada"
}
