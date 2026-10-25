import { z } from "zod"

import type { Schemas } from "@/api/client"

// Mismas listas y reglas que web/backend/src/schemas/profile.ts.

type Country = Exclude<NonNullable<Schemas["ProfilePatch"]["country"]>, "">
type GameRole = Exclude<NonNullable<Schemas["ProfilePatch"]["game_role"]>, "">

export const COUNTRIES = [
  "Argentina",
  "Bolivia",
  "Brasil",
  "Chile",
  "Colombia",
  "Costa Rica",
  "Cuba",
  "Ecuador",
  "El Salvador",
  "España",
  "Estados Unidos",
  "Guatemala",
  "Honduras",
  "México",
  "Nicaragua",
  "Panamá",
  "Paraguay",
  "Perú",
  "Puerto Rico",
  "República Dominicana",
  "Uruguay",
  "Venezuela",
  "Otro",
] as const satisfies readonly Country[]

export const GAME_ROLES = [
  "AWPer",
  "Rifler",
  "IGL",
  "Support",
  "Entry fragger",
  "Lurker",
  "Otro",
] as const satisfies readonly GameRole[]

// Falla el typecheck si el backend agrega un país o un rol que falta acá.
type AssertNever<T extends never> = T
export type _CountriesComplete = AssertNever<
  Exclude<Country, (typeof COUNTRIES)[number]>
>
export type _RolesComplete = AssertNever<
  Exclude<GameRole, (typeof GAME_ROLES)[number]>
>

export const STEAM_LINK =
  /^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/(id|profiles)\/([A-Za-z0-9_-]{2,64})\/?$/i
const NICK = /^[A-Za-z0-9_-]{2,32}$/

const optional = (max: number, test: (v: string) => boolean, message: string) =>
  z
    .string()
    .trim()
    .max(max, `Hasta ${max} caracteres.`)
    .refine((v) => v === "" || test(v), message)

export const personalSchema = z.object({
  real_name: optional(
    60,
    (v) => /^[\p{L}\p{M}' .-]{1,60}$/u.test(v),
    "Solo letras, espacios, punto, apóstrofe y guion."
  ),
  country: z.union([z.enum(COUNTRIES), z.literal("")]),
  game_role: z.union([z.enum(GAME_ROLES), z.literal("")]),
})
export type PersonalValues = z.infer<typeof personalSchema>

export const FACEIT_LINK =
  /^(?:https?:\/\/)?(?:www\.)?faceit\.com\/[a-z-]+\/players\/([^/?#]+)/i

export const socialsSchema = z.object({
  // Solo el link del perfil, como dato informativo: el SteamID se vincula con !claim.
  // Se guarda normalizado (https, sin www), que es lo que acepta la API.
  steam: z
    .string()
    .trim()
    .transform((v) => {
      const m = v.match(STEAM_LINK)
      return m ? `https://steamcommunity.com/${m[1].toLowerCase()}/${m[2]}` : v
    })
    .refine(
      (v) => v === "" || STEAM_LINK.test(v),
      "Pega el link de tu perfil de Steam (steamcommunity.com/id/… o /profiles/…)."
    ),
  // Se guarda el nick: del link faceit.com/{idioma}/players/{nick} queda solo el nick.
  faceit: z
    .string()
    .trim()
    .transform((v) => v.match(FACEIT_LINK)?.[1] ?? v)
    .refine(
      (v) => v === "" || NICK.test(v),
      "Usa tu nick de FACEIT o el link de tu perfil."
    ),
  // Usuario de Discord actual: sin el #1234 de las cuentas viejas y en minúsculas.
  discord: z
    .string()
    .trim()
    .transform((v) => v.replace(/#\d{1,4}$/, "").toLowerCase())
    .refine(
      (v) => v === "" || /^[a-z0-9_.]{2,32}$/.test(v),
      "De 2 a 32 caracteres: minúsculas, números, _ y punto."
    ),
})
export type SocialsInput = z.input<typeof socialsSchema>
export type SocialsValues = z.output<typeof socialsSchema>

/** Solo los campos completados: en el registro un campo vacío no se envía (en PATCH, "" lo borraría). */
export function filledFields<T extends Record<string, string>>(
  values: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v.trim() !== "")
  ) as Partial<T>
}
