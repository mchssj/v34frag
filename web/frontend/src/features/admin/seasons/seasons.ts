import { LEVEL_FLOORS } from "@/features/player/labels"
import type { Season, SeasonConfig, SeasonTier } from "./queries"

// Reglas de la sección Temporadas que no dependen de React (contrato temporadas.md, 8f).

/** Lo que se edita en "Temporada activa" (con fecha de fin) y en "Próxima temporada" (con días). */
export type SeasonForm = {
  name: string
  ends: string
  days: number
  top_n: number
  min_matches: number
  reset_pct: number
  reset_floor: number
  /** El reinicio incluye a los que están debajo del piso. */
  reset_all: boolean
  tiers: SeasonTier[]
}

export const LIMITS = {
  days: [1, 365],
  top_n: [1, 500],
  min_matches: [1, 1000],
  reset_pct: [0, 100],
  reset_floor: [0, 10000],
} as const

/**
 * Reinicio: quien está sobre el piso conserva el porcentaje de lo que tiene por encima.
 * Con `all`, los de debajo del piso también (suben hacia el piso); con 0 %, todos quedan en el piso.
 */
export function resetElo(
  elo: number,
  pct: number,
  floor: number,
  all = false
): number {
  return elo > floor || all
    ? floor + Math.round(((elo - floor) * pct) / 100)
    : elo
}

/** Título del reinicio según el piso: el nivel del primer ELO que se reinicia (piso + 1). */
export function resetTitle(floor: number, all = false): string {
  if (all) return "Reinicio de todos"
  if (floor < 0) return "Reinicio del ELO"
  const level = LEVEL_FLOORS.filter((f) => f <= floor + 1).length
  return level === 10
    ? "Reinicio de los nivel 10"
    : `Reinicio desde el nivel ${level}`
}

/** Las reglas del reinicio en una frase, para confirmar el cierre. */
export function resetRule(pct: number, floor: number, all: boolean): string {
  if (all && pct === 0)
    return `Reinicio total: todos quedan en ${floor} de ELO.`
  if (all)
    return `Reinicio de todos: conservan el ${pct} % de su distancia a ${floor}, por encima o por debajo.`
  if (pct === 100) return "Sin reinicio: nadie cambia de ELO."
  return `Reinicio: los de más de ${floor} de ELO conservan el ${pct} % de lo que tienen por encima. El resto no cambia.`
}

/** El cierre es a las 06:00 de Argentina (09:00 UTC) del día elegido. */
export const endsIso = (date: string) => `${date}T09:00:00.000Z`

/** Día (AAAA-MM-DD) en Argentina de una fecha ISO. */
export function argDay(iso: string): string {
  return new Date(new Date(iso).getTime() - 3 * 3_600_000)
    .toISOString()
    .slice(0, 10)
}

export const tierName = (t: SeasonTier, top: number) =>
  t.name.replace("{top}", String(top))

export function fromSeason(s: Season): SeasonForm {
  return {
    name: s.name,
    ends: argDay(s.ends_at),
    days: 30,
    top_n: s.top_n,
    min_matches: s.min_matches,
    reset_pct: s.reset_pct,
    reset_floor: s.reset_floor,
    reset_all: s.reset_all,
    tiers: s.tiers.map((t) => ({ ...t })),
  }
}

export function fromConfig(c: SeasonConfig): SeasonForm {
  return {
    name: "",
    ends: "",
    days: c.duration_days,
    top_n: c.top_n,
    min_matches: c.min_matches,
    reset_pct: c.reset_pct,
    reset_floor: c.reset_floor,
    reset_all: c.reset_all ?? false,
    tiers: c.tiers.map((t) => ({ ...t })),
  }
}

/** Por qué los tramos no sirven, o null: desde el 1, sin huecos, el último sin fin y dentro del top. */
export function tiersError(tiers: SeasonTier[], top: number): string | null {
  if (tiers.length === 0) return "Tiene que haber al menos un tramo."
  for (const [i, t] of tiers.entries()) {
    const last = i === tiers.length - 1
    if (!t.name.trim() || !t.icon.trim())
      return "Cada tramo necesita ícono y nombre."
    if (t.from !== (i === 0 ? 1 : (tiers[i - 1].to ?? 0) + 1))
      return "Los tramos tienen que seguirse sin huecos, desde el puesto 1."
    if (!last && (t.to === null || t.to < t.from))
      return "Un tramo termina antes de empezar."
    if (t.from > top)
      return `El tramo desde el puesto ${t.from} queda fuera del top (${top}).`
  }
  return null
}

const inRange = (v: number, [min, max]: readonly [number, number]) =>
  Number.isInteger(v) && v >= min && v <= max

/** Por qué no se puede guardar el formulario, o null. */
export function formError(
  f: SeasonForm,
  mode: "active" | "next"
): string | null {
  if (mode === "active" && !f.name.trim()) return "Falta el nombre."
  if (mode === "active" && !(f.ends && new Date(endsIso(f.ends)) > new Date()))
    return "La fecha de fin tiene que ser futura."
  if (mode === "next" && !inRange(f.days, LIMITS.days))
    return "La duración va de 1 a 365 días."
  if (!inRange(f.top_n, LIMITS.top_n)) return "El top va de 1 a 500."
  if (!inRange(f.min_matches, LIMITS.min_matches))
    return "El mínimo va de 1 a 1000 mixes."
  if (!inRange(f.reset_pct, LIMITS.reset_pct))
    return "El porcentaje va de 0 a 100."
  if (!inRange(f.reset_floor, LIMITS.reset_floor))
    return "El piso va de 0 a 10000."
  return tiersError(f.tiers, f.top_n)
}

/** Cambia dónde termina el tramo `i`; el siguiente empieza justo después. */
export function setTierEnd(tiers: SeasonTier[], i: number, to: number) {
  return tiers.map((t, j) =>
    j === i ? { ...t, to } : j === i + 1 ? { ...t, from: to + 1 } : t
  )
}

/** Suma un tramo al final: el último pasa a terminar en su primer puesto. */
export function addTier(tiers: SeasonTier[]): SeasonTier[] {
  const last = tiers.at(-1)
  if (!last) return [{ from: 1, to: null, name: "Top {top}", icon: "🏅" }]
  return [
    ...tiers.slice(0, -1),
    { ...last, to: last.from },
    { from: last.from + 1, to: null, name: "Top {top}", icon: "🏅" },
  ]
}

/** Quita un tramo y vuelve a encadenar los puestos. */
export function removeTier(tiers: SeasonTier[], i: number): SeasonTier[] {
  const rest = tiers.filter((_, j) => j !== i)
  return rest.map((t, j) => ({
    ...t,
    from: j === 0 ? 1 : (rest[j - 1].to ?? 0) + 1,
    to: j === rest.length - 1 ? null : t.to,
  }))
}

/** Lo que cambió de la temporada activa, para el PATCH. */
export function seasonPatch(s: Season, f: SeasonForm) {
  const base = fromSeason(s)
  return {
    ...(f.name.trim() !== base.name ? { name: f.name.trim() } : {}),
    ...(f.ends !== base.ends ? { ends_at: endsIso(f.ends) } : {}),
    ...(f.top_n !== base.top_n ? { top_n: f.top_n } : {}),
    ...(f.min_matches !== base.min_matches
      ? { min_matches: f.min_matches }
      : {}),
    ...(f.reset_pct !== base.reset_pct ? { reset_pct: f.reset_pct } : {}),
    ...(f.reset_floor !== base.reset_floor
      ? { reset_floor: f.reset_floor }
      : {}),
    ...(f.reset_all !== base.reset_all ? { reset_all: f.reset_all } : {}),
    ...(JSON.stringify(f.tiers) !== JSON.stringify(base.tiers)
      ? { tiers: f.tiers }
      : {}),
  }
}

export function toConfig(f: SeasonForm): SeasonConfig {
  return {
    duration_days: f.days,
    top_n: f.top_n,
    min_matches: f.min_matches,
    reset_pct: f.reset_pct,
    reset_floor: f.reset_floor,
    reset_all: f.reset_all,
    tiers: f.tiers,
  }
}
