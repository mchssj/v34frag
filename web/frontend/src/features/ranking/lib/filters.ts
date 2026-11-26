import { z } from "zod"

import { LEVEL_FLOORS } from "@/features/player/lib/labels"
import { bareMap, type Chip } from "@/features/search/lib/search"

// Filtros avanzados del ranking de jugadores (VIP, bitácora 2026-11-24-exportar-stats-y-buscador-vip): los mismos en la
// temporada y en el Histórico. Viven en la URL con los demás del ranking.

export const ELO_MAX = 2500

const num = (min: number, max: number) =>
  z.number().min(min).max(max).optional().catch(undefined)
const str = z.string().min(1).max(60).optional().catch(undefined)

export const playerFilterShape = {
  lvMin: num(1, 10),
  lvMax: num(1, 10),
  eloMin: num(0, ELO_MAX),
  eloMax: num(0, ELO_MAX),
  kd: num(0, 3),
  rt: num(0, 3),
  hs: num(0, 100),
  mx: num(0, 500),
  act: z
    .union([z.literal(7), z.literal(30), z.literal(90)])
    .optional()
    .catch(undefined),
  fav: str,
  ct: str,
  team: z.enum(["with", "without"]).optional().catch(undefined),
  vip: z.boolean().optional().catch(undefined),
}
export type PlayerFilters = z.infer<z.ZodObject<typeof playerFilterShape>>

/** Rango de ELO de un rango de niveles: el nivel n va de LEVEL_FLOORS[n - 1] hasta antes de LEVEL_FLOORS[n]. */
export function levelRange(min = 1, max = 10): { min?: number; max?: number } {
  return {
    ...(min > 1 ? { min: LEVEL_FLOORS[min - 1] } : {}),
    ...(max < 10 ? { max: LEVEL_FLOORS[max]! - 1 } : {}),
  }
}

/** Parámetros de los filtros en la API. El nivel se manda como rango de ELO (el más angosto de los dos). */
export function toFilterQuery(s: PlayerFilters) {
  const lv = levelRange(s.lvMin, s.lvMax)
  const lows = [lv.min, s.eloMin].filter((x) => x !== undefined)
  const highs = [lv.max, s.eloMax].filter((x) => x !== undefined)
  return {
    ...(lows.length ? { elo_min: Math.max(...lows) } : {}),
    ...(highs.length ? { elo_max: Math.min(...highs) } : {}),
    ...(s.kd ? { kd_min: s.kd } : {}),
    ...(s.rt ? { rating_min: s.rt } : {}),
    ...(s.hs ? { hs_min: s.hs } : {}),
    ...(s.mx ? { matches_min: s.mx } : {}),
    ...(s.act ? { active_days: s.act } : {}),
    ...(s.fav ? { map: bareMap(s.fav) } : {}),
    ...(s.ct ? { country: s.ct } : {}),
    ...(s.team
      ? { has_team: s.team === "with" ? ("true" as const) : ("false" as const) }
      : {}),
    ...(s.vip ? { vip: "true" as const } : {}),
  }
}

/** Una píldora por filtro activo y las claves que hay que borrar para sacarla. */
export function playerChips(s: PlayerFilters) {
  const chips: Chip<keyof PlayerFilters>[] = []
  const add = (label: string, ...clear: (keyof PlayerFilters)[]) =>
    chips.push({ label, clear })
  if (s.lvMin !== undefined || s.lvMax !== undefined)
    add(`Nivel ${s.lvMin ?? 1} a ${s.lvMax ?? 10}`, "lvMin", "lvMax")
  if (s.eloMin !== undefined || s.eloMax !== undefined)
    add(
      s.eloMax === undefined
        ? `ELO desde ${s.eloMin}`
        : `ELO ${s.eloMin ?? 0} a ${s.eloMax}`,
      "eloMin",
      "eloMax"
    )
  if (s.kd) add(`K/D desde ${s.kd.toFixed(2)}`, "kd")
  if (s.rt) add(`Rating desde ${s.rt.toFixed(2)}`, "rt")
  if (s.hs) add(`HS desde ${s.hs} %`, "hs")
  if (s.mx) add(`Desde ${s.mx} partidas`, "mx")
  if (s.act) add(`Jugó en los últimos ${s.act} días`, "act")
  if (s.fav) add(`Mapa más jugado: ${bareMap(s.fav)}`, "fav")
  if (s.ct) add(s.ct, "ct")
  if (s.team) add(s.team === "with" ? "Con equipo" : "Sin equipo", "team")
  if (s.vip) add("Solo VIP", "vip")
  return chips
}
