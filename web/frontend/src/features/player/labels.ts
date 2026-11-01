import {
  format,
  formatDistanceStrict,
  formatDistanceToNow,
  parseISO,
} from "date-fns"
import { es } from "date-fns/locale"

import { mapEntryOf, type MapEntry } from "@/features/maps/queries"
import { FACEIT_LINK, STEAM_LINK } from "@/features/profile/schemas"
import type {
  EloAdjustment,
  MapStat,
  PlayerMatch,
  PlayerSeason,
} from "./queries"

// Textos y cálculos del perfil público (handoff_perfil_publico y contrato 5).

/** Pisos de ELO de cada nivel (contrato 5): el nivel n empieza en LEVEL_FLOORS[n - 1]. */
export const LEVEL_FLOORS = [
  0, 501, 751, 901, 1051, 1201, 1351, 1531, 1751, 2001,
]

/** "Faltan {n} ELO para nivel {n+1} ({elo})." o "Nivel máximo alcanzado." */
export function nextLevelText(level: number, elo: number): string {
  if (level >= 10) return "Nivel máximo alcanzado."
  const next = LEVEL_FLOORS[level]
  return `Faltan ${next - elo} ELO para nivel ${level + 1} (${next}).`
}

/** Tramo de la escalera: superado, actual o siguiente. */
export function ladderState(
  n: number,
  level: number
): "done" | "current" | "next" {
  return n < level ? "done" : n === level ? "current" : "next"
}

/**
 * Link de Steam solo si es un perfil de steamcommunity.com. Muchos perfiles de la web vieja tienen un
 * SteamID escrito a mano, y el perfil público nunca muestra SteamID.
 */
export function steamUrl(v: string | null | undefined): string | null {
  const m = v?.trim().match(STEAM_LINK)
  return m ? `https://steamcommunity.com/${m[1].toLowerCase()}/${m[2]}` : null
}

/** FACEIT: la web nueva guarda el nick; la vieja, el link completo. */
export function faceitUrl(v: string | null | undefined): string | null {
  const t = v?.trim()
  if (!t) return null
  const m = t.match(FACEIT_LINK)
  const nick = m ? m[1] : /^[A-Za-z0-9_-]{2,32}$/.test(t) ? t : null
  return nick
    ? `https://www.faceit.com/es/players/${encodeURIComponent(nick)}`
    : null
}

/** Marcador desde el lado del jugador ("13:9"). */
export function scoreOf(m: PlayerMatch): string | null {
  if (m.score1 === null || m.score2 === null) return null
  return m.side === 2 ? `${m.score2}:${m.score1}` : `${m.score1}:${m.score2}`
}

/** "24 oct" */
export const fmtDay = (iso: string) =>
  format(parseISO(iso), "dd MMM", { locale: es }).replace(".", "")

/** "14 de marzo de 2026" */
export const fmtLong = (iso: string) =>
  format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: es })

/** "marzo de 2026" */
export const fmtMonth = (iso: string) =>
  format(parseISO(iso), "MMMM 'de' yyyy", { locale: es })

/** "hace 2 horas" */
export const fmtAgo = (iso: string) =>
  formatDistanceToNow(parseISO(iso), { locale: es, addSuffix: true })

export const KIND_LABEL: Record<PlayerMatch["kind"], string> = {
  mix: "Mix",
  pcw: "PCW",
  official: "Torneo",
}

/**
 * Título y subtítulo de una partida (contrato 5): en un mix, "Mix · {mapa}" y "{fecha} · {marcador}";
 * en un torneo, "{bando 1} vs {bando 2}" y "{torneo} · {fase}"; en una PCW, los bandos y "PCW · {mapa}".
 */
export function matchTitle(m: PlayerMatch): { title: string; sub: string } {
  const map = m.map ?? "Mapa"
  const sides = `${m.side1_name ?? "Bando 1"} vs ${m.side2_name ?? "Bando 2"}`
  if (m.kind === "mix") {
    const parts = [m.played_at ? fmtDay(m.played_at) : null, scoreOf(m)]
    return { title: `Mix · ${map}`, sub: parts.filter(Boolean).join(" · ") }
  }
  if (m.kind === "official") {
    const parts = [m.event?.name, m.label].filter(Boolean)
    return {
      title: sides,
      sub: parts.length ? parts.join(" · ") : `Torneo · ${map}`,
    }
  }
  return { title: sides, sub: `PCW · ${map}` }
}

/** Resultado: V, D o E (empate, o sin resultado). */
export function resultOf(won: boolean | null): "V" | "D" | "E" {
  return won === true ? "V" : won === false ? "D" : "E"
}

const ROLES: Record<string, string> = {
  player: "Activo",
  sub: "Suplente",
  coach: "Coach",
}

/** "Activo · líder", "Suplente" (vocabulario nuevo de Equipo). */
export function stintRole(role: string, isCaptain: boolean): string {
  const r = ROLES[role] ?? role
  return isCaptain ? `${r} · líder` : r
}

/** "desde marzo de 2026", "enero de 2026 – marzo de 2026" o "—" (planteles migrados, sin fecha). */
export function stintPeriod(
  joined: string | null,
  left: string | null
): string {
  if (joined && left) return `${fmtMonth(joined)} – ${fmtMonth(left)}`
  if (joined) return `desde ${fmtMonth(joined)}`
  if (left) return `hasta ${fmtMonth(left)}`
  return "—"
}

/** "jul 2026" */
export const fmtMonthShort = (iso: string) =>
  format(parseISO(iso), "MMM yyyy", { locale: es }).replace(".", "")

/** Cuánto estuvo en un equipo ("3 meses", "12 días"); hasta hoy si sigue. Sin alta, null. */
export function stintLength(
  joined: string | null,
  left: string | null,
  now = new Date()
): string | null {
  if (!joined) return null
  return formatDistanceStrict(left ? parseISO(left) : now, parseISO(joined), {
    locale: es,
  })
}

export type MapCard = {
  key: string
  /** El jugado (cada versión tiene su tarjeta); sin partidas, el del catálogo sin de_/cs_, como
   * los guarda la base. */
  name: string
  image: string | null
  stat: MapStat | null
  retired: boolean
}

/**
 * Pestaña Mapas: primero los jugados (en el orden de la API, por mapas jugados) y después los
 * mapas activos del catálogo que no jugó, en el orden del catálogo y sin estadísticas. Un mapa
 * retirado aparece solo si lo jugó.
 */
export function mapCards(
  catalog: MapEntry[] | undefined,
  stats: MapStat[]
): MapCard[] {
  const used = new Set<string>()
  const played = stats.map((s) => {
    const entry = mapEntryOf(catalog, s.map)
    if (entry) used.add(entry.name)
    return {
      key: s.map,
      name: s.map,
      image: entry?.image_url ?? null,
      stat: s,
      retired: entry ? !entry.active : false,
    }
  })
  const rest = (catalog ?? [])
    .filter((m) => m.active && !used.has(m.name))
    .sort((a, b) => a.position - b.position)
    .map((m) => ({
      key: m.name,
      name: m.name.replace(/^(de|cs)_/i, ""),
      image: m.image_url,
      stat: null,
      retired: false,
    }))
  return [...played, ...rest]
}

/** La mejor temporada (el mejor puesto con clasificación), solo si jugó más de una. */
export function bestSeasonId(seasons: PlayerSeason[]): string | null {
  if (seasons.length < 2) return null
  const ranked = seasons.filter((s) => s.eligible && s.rank !== null)
  if (!ranked.length) return null
  return ranked.reduce((a, b) => ((b.rank ?? 0) < (a.rank ?? 0) ? b : a)).season
    .id
}

/** Equipos escritos a mano en la web vieja: una línea por equipo → "A · B · C". */
export function legacyTeams(text: string | null | undefined): string | null {
  const names = (text ?? "")
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
  return names.length ? names.join(" · ") : null
}

/** "+20" o "Fijado en 1500". */
export function adjustmentLabel(a: EloAdjustment): string {
  if (a.kind === "set") return `Fijado en ${a.set_elo ?? "—"}`
  return a.delta > 0 ? `+${a.delta}` : String(a.delta)
}

/** Ancho de la barra de un tile (0 a 100) contra una escala fija. */
export function tilePct(v: number | null | undefined, scale: number): number {
  if (v === null || v === undefined || v <= 0) return 0
  return Math.min(100, Math.round((v / scale) * 100))
}
