import { z } from "zod"

import { LEVEL_FLOORS } from "@/features/player/labels"

import type { SearchMatch, SearchPlayer } from "./demo"

// Estado del buscador en la URL, como features/ranking/search.ts: un valor inválido vuelve al de por
// defecto. El texto y el orden son para todos; el resto son filtros avanzados (VIP).

const num = (min: number, max: number) =>
  z.number().min(min).max(max).optional().catch(undefined)
const str = z.string().max(40).optional().catch(undefined)
const flag = z.boolean().optional().catch(undefined)
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)

export const searchSchema = z.object({
  tab: z.enum(["jugadores", "partidas"]).optional().catch(undefined),
  q: z.string().max(60).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
  // Jugadores.
  psort: z
    .enum(["elo", "kd", "rating", "matches", "recent"])
    .optional()
    .catch(undefined),
  lvMin: num(1, 10),
  lvMax: num(1, 10),
  eloMin: num(0, 2500),
  eloMax: num(0, 2500),
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
  vip: flag,
  // Partidas.
  msort: z.enum(["date", "close", "mvp"]).optional().catch(undefined),
  with: str,
  vs: str,
  map: str,
  kind: z.enum(["mix", "pcw", "official"]).optional().catch(undefined),
  from: day,
  to: day,
  diff: num(0, 16),
  demo: flag,
  cancel: flag,
})
export type Search = z.infer<typeof searchSchema>

/** Claves que solo aplican con VIP. Sin VIP se ignoran aunque vengan en la URL. */
export const PLAYER_ADVANCED = [
  "lvMin",
  "lvMax",
  "eloMin",
  "eloMax",
  "kd",
  "rt",
  "hs",
  "mx",
  "act",
  "fav",
  "ct",
  "team",
  "vip",
] as const satisfies readonly (keyof Search)[]
export const MATCH_ADVANCED = [
  "with",
  "vs",
  "map",
  "kind",
  "from",
  "to",
  "diff",
  "demo",
  "cancel",
] as const satisfies readonly (keyof Search)[]

export const PER = 20

export const KIND_LABEL = {
  mix: "Mix",
  pcw: "PCW",
  official: "Oficial",
} as const
export const PLAYER_SORTS = {
  elo: "ELO",
  kd: "K/D",
  rating: "Rating",
  matches: "Mixes",
  recent: "Última partida",
} as const
export const MATCH_SORTS = {
  date: "Más nuevas",
  close: "Más parejas",
  mvp: "Mejor MVP",
} as const

/**
 * Rango de ELO de un rango de niveles, con los mismos pisos que el backend (`LEVEL_FLOORS` y
 * `levelBounds` de web/backend/src/lib/db.ts): el nivel n va de LEVEL_FLOORS[n - 1] hasta antes de
 * LEVEL_FLOORS[n]. Así la API puede filtrar por ELO sin guardar el nivel.
 */
export function levelRange(min = 1, max = 10): { gte?: number; lt?: number } {
  return {
    ...(min > 1 ? { gte: LEVEL_FLOORS[min - 1] } : {}),
    ...(max < 10 ? { lt: LEVEL_FLOORS[max] } : {}),
  }
}

const has = (s: string, q: string) => s.toLowerCase().includes(q.toLowerCase())
const diffOf = (m: SearchMatch) => Math.abs(m.score[0] - m.score[1])

export function filterPlayers(all: SearchPlayer[], s: Search, vip: boolean) {
  const q = s.q?.trim()
  const a: Search = vip ? s : {}
  const lv = levelRange(a.lvMin, a.lvMax)
  const out = all.filter(
    (p) =>
      (!q || has(p.nick, q) || (p.team_tag !== null && has(p.team_tag, q))) &&
      (lv.gte === undefined || p.elo >= lv.gte) &&
      (lv.lt === undefined || p.elo < lv.lt) &&
      (a.eloMin === undefined || p.elo >= a.eloMin) &&
      (a.eloMax === undefined || p.elo <= a.eloMax) &&
      (a.kd === undefined || p.kd >= a.kd) &&
      (a.rt === undefined || p.rating >= a.rt) &&
      (a.hs === undefined || p.hs >= a.hs) &&
      (a.mx === undefined || p.matches >= a.mx) &&
      (a.act === undefined || p.last_days <= a.act) &&
      (!a.fav || p.fav_map === a.fav) &&
      (!a.ct || p.country === a.ct) &&
      (!a.team || (a.team === "with") === (p.team_tag !== null)) &&
      (!a.vip || p.vip)
  )
  const by: Record<
    NonNullable<Search["psort"]>,
    (p: SearchPlayer) => number
  > = {
    elo: (p) => p.elo,
    kd: (p) => p.kd,
    rating: (p) => p.rating,
    matches: (p) => p.matches,
    recent: (p) => -p.last_days,
  }
  const key = by[s.psort ?? "elo"]
  return out.sort((x, y) => key(y) - key(x))
}

export function filterMatches(all: SearchMatch[], s: Search, vip: boolean) {
  const q = s.q?.trim()
  const a: Search = vip ? s : {}
  const inA = (m: SearchMatch, n: string) => m.team_a.some((p) => has(p, n))
  const inB = (m: SearchMatch, n: string) => m.team_b.some((p) => has(p, n))
  const out = all.filter(
    (m) =>
      (!q || has(m.map, q) || inA(m, q) || inB(m, q)) &&
      (!a.with || inA(m, a.with) || inB(m, a.with)) &&
      // "Contra": los dos jugadores en bandos distintos.
      (!a.vs ||
        (a.with
          ? (inA(m, a.with) && inB(m, a.vs)) || (inB(m, a.with) && inA(m, a.vs))
          : inA(m, a.vs) || inB(m, a.vs))) &&
      (!a.map || m.map === a.map) &&
      (!a.kind || m.kind === a.kind) &&
      (!a.from || m.date >= a.from) &&
      (!a.to || m.date <= a.to) &&
      (a.diff === undefined || diffOf(m) <= a.diff) &&
      (!a.demo || m.has_demo) &&
      (a.cancel || !m.cancelled)
  )
  const sort = s.msort ?? "date"
  if (sort === "close")
    return out.sort(
      (x, y) => diffOf(x) - diffOf(y) || y.date.localeCompare(x.date)
    )
  if (sort === "mvp") return out.sort((x, y) => y.mvp_rating - x.mvp_rating)
  return out.sort((x, y) => y.date.localeCompare(x.date))
}

/** Chips de los filtros activos: texto y las claves que hay que borrar al sacarlo. */
export function activeChips(s: Search, tab: "jugadores" | "partidas") {
  const chips: { label: string; clear: (keyof Search)[] }[] = []
  const add = (label: string, ...clear: (keyof Search)[]) =>
    chips.push({ label, clear })
  if (tab === "jugadores") {
    if (s.lvMin !== undefined || s.lvMax !== undefined)
      add(`Nivel ${s.lvMin ?? 1}–${s.lvMax ?? 10}`, "lvMin", "lvMax")
    if (s.eloMin !== undefined || s.eloMax !== undefined)
      add(`ELO ${s.eloMin ?? 0}–${s.eloMax ?? 2500}`, "eloMin", "eloMax")
    if (s.kd !== undefined) add(`K/D ≥ ${s.kd.toFixed(2)}`, "kd")
    if (s.rt !== undefined) add(`Rating ≥ ${s.rt.toFixed(2)}`, "rt")
    if (s.hs !== undefined) add(`HS ≥ ${s.hs}%`, "hs")
    if (s.mx !== undefined) add(`≥ ${s.mx} mixes`, "mx")
    if (s.act !== undefined) add(`Activo en ${s.act} días`, "act")
    if (s.fav) add(`Mapa favorito: ${s.fav}`, "fav")
    if (s.ct) add(s.ct, "ct")
    if (s.team) add(s.team === "with" ? "Con equipo" : "Sin equipo", "team")
    if (s.vip) add("Solo VIP", "vip")
  } else {
    if (s.with) add(`Con ${s.with}`, "with")
    if (s.vs) add(`Contra ${s.vs}`, "vs")
    if (s.map) add(s.map, "map")
    if (s.kind) add(KIND_LABEL[s.kind], "kind")
    if (s.from || s.to) add(`${s.from ?? "…"} → ${s.to ?? "hoy"}`, "from", "to")
    if (s.diff !== undefined) add(`Diferencia ≤ ${s.diff}`, "diff")
    if (s.demo) add("Con demo", "demo")
    if (s.cancel) add("Incluye canceladas", "cancel")
  }
  return chips
}
