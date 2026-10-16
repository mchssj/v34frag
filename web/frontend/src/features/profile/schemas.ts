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

const STEAM64 = /^(7656119\d{10}|765612\d{11})$/
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

export const socialsSchema = z.object({
  steam: optional(
    120,
    (v) =>
      /^https?:\/\/steamcommunity\.com\/(id|profiles)\/[A-Za-z0-9_-]+\/?$/i.test(
        v
      ) ||
      STEAM64.test(v) ||
      /^STEAM_[0-5]:[01]:\d+$/i.test(v) ||
      NICK.test(v),
    "Usa tu SteamID64 (17 dígitos), el link de tu perfil o tu nombre de perfil."
  ),
  faceit: optional(
    120,
    (v) => /^https?:\/\/(www\.)?faceit\.com\/\S*$/i.test(v) || NICK.test(v),
    "Usa tu nickname de FACEIT o el link de tu perfil."
  ),
  discord: optional(
    40,
    (v) => /^[A-Za-z0-9_.#-]{2,40}$/.test(v),
    "Usa tu nombre de usuario de Discord, sin espacios."
  ),
})
export type SocialsValues = z.infer<typeof socialsSchema>

/** Solo los campos completados: en el registro un campo vacío no se envía (en PATCH, "" lo borraría). */
export function filledFields<T extends Record<string, string>>(
  values: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v.trim() !== "")
  ) as Partial<T>
}
