import { PIN_TIERS, type PinMetal, type PinTier } from "@/features/pins/pinSvg"

// Reparto de pines del prototipo (plan docs/bitacora/2026-11-14-pines-de-torneo, secciones 2 y 3). En la base lo hará
// event_final_places + event_award_pins con el bracket real; acá se simula con la cantidad de equipos.

export type Format = "single" | "double" | "groups" | "rr" | "swiss"

export type TierConfig = { on: boolean; metal: PinMetal; min: number | null }
export type PinsConfig = {
  enabled: boolean
  tiers: Record<PinTier, TierConfig>
}

export const DEFAULT_CONFIG: PinsConfig = {
  enabled: true,
  tiers: {
    champion: { on: true, metal: "oro", min: null },
    finalist: { on: true, metal: "plata", min: null },
    third: { on: true, metal: "bronce", min: null },
    semifinalist: { on: true, metal: "bronce", min: 4 },
    quarter: { on: true, metal: "acero", min: 8 },
    round16: { on: false, metal: "acero", min: 16 },
    participant: { on: false, metal: "acero", min: 8 },
  },
}

export type Setup = {
  format: Format
  teams: number
  /** Partido por el tercer puesto (eliminación simple y playoffs). */
  third: boolean
  /** Equipos que pasan a playoffs (grupos y suiza). */
  playoff: number
}

const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)))

const placeLabel = (a: number, b: number) =>
  a === b ? `${a}.º` : `${a}.º-${b}.º`

type Natural = { tier: PinTier; place: number; label: string }

/** Puestos de una llave de eliminación simple con `m` equipos, desde el puesto `from`. */
function ko(m: number, third: boolean): Natural[] {
  const out: Natural[] = [{ tier: "champion", place: 1, label: "1.º" }]
  if (m < 2) return out
  out.push({ tier: "finalist", place: 2, label: "2.º" })
  const P = nextPow2(m)
  for (let s = 4; s <= P; s *= 2) {
    const losers = s === P ? m - P / 2 : s / 2
    const from = s / 2 + 1
    const tier: PinTier =
      s === 4
        ? "semifinalist"
        : s === 8
          ? "quarter"
          : s === 16
            ? "round16"
            : "participant"
    for (let i = 0; i < losers; i++) {
      if (s === 4 && third && losers === 2) {
        out.push(
          i === 0
            ? { tier: "third", place: 3, label: "3.º" }
            : { tier: "semifinalist", place: 4, label: "4.º" }
        )
      } else {
        out.push({ tier, place: from, label: placeLabel(from, s) })
      }
    }
  }
  return out
}

export function naturalPlaces(s: Setup): Natural[] {
  const n = s.teams
  if (s.format === "single") return ko(n, s.third)
  if (s.format === "double") {
    return Array.from({ length: n }, (_, i) => {
      const p = i + 1
      if (p === 1) return { tier: "champion", place: 1, label: "1.º" }
      if (p === 2) return { tier: "finalist", place: 2, label: "2.º" }
      if (p === 3) return { tier: "third", place: 3, label: "3.º" }
      if (p === 4) return { tier: "semifinalist", place: 4, label: "4.º" }
      if (p <= 6) return { tier: "quarter", place: 5, label: "5.º-6.º" }
      if (p <= 8) return { tier: "quarter", place: 7, label: "7.º-8.º" }
      if (p <= 12) return { tier: "round16", place: 9, label: "9.º-12.º" }
      if (p <= 16) return { tier: "round16", place: 13, label: "13.º-16.º" }
      return { tier: "participant", place: 17, label: `17.º-${n}.º` }
    })
  }
  if (s.format === "rr") {
    return Array.from({ length: n }, (_, i) => {
      const p = i + 1
      const tier: PinTier =
        p === 1
          ? "champion"
          : p === 2
            ? "finalist"
            : p === 3
              ? "third"
              : "participant"
      return { tier, place: p, label: `${p}.º` }
    })
  }
  const k = Math.min(s.playoff, n)
  const rest = Array.from({ length: n - k }, () => ({
    tier: "participant" as const,
    place: k + 1,
    label: s.format === "groups" ? "Fase de grupos" : "Fase suiza",
  }))
  return [...ko(k, s.third), ...rest]
}

/** Si el escalón existe con este formato y esta cantidad de equipos; si no, por qué. */
export function tierExists(t: PinTier, s: Setup): string | null {
  const n = s.teams
  const m =
    s.format === "groups" || s.format === "swiss" ? Math.min(s.playoff, n) : n
  const kos =
    s.format === "single" || s.format === "groups" || s.format === "swiss"
  const fmt = FORMAT_LABEL[s.format].toLowerCase()
  switch (t) {
    case "champion":
    case "finalist":
      return null
    case "third":
      if (s.format === "double") return n >= 3 ? null : "Hacen falta 3 equipos"
      if (s.format === "rr") return n >= 3 ? null : "Hacen falta 3 equipos"
      if (!s.third) return "No se juega el partido por el tercer puesto"
      return m >= 4 ? null : "Sin semifinales no hay tercer puesto"
    case "semifinalist":
      if (s.format === "rr") return "En todos contra todos no hay semifinales"
      return (kos ? m : n) >= (s.format === "double" ? 4 : 3)
        ? null
        : `Con ${m} equipos en la llave no hay semifinales`
    case "quarter":
      if (s.format === "rr") return "En todos contra todos no hay cuartos"
      return (kos ? m : n) >= 5
        ? null
        : `Con ${kos ? m : n} equipos en la llave no hay cuartos`
    case "round16":
      if (s.format === "rr") return "En todos contra todos no hay octavos"
      return (kos ? m : n) >= 9
        ? null
        : `Con ${kos ? m : n} equipos en la llave no hay octavos`
    case "participant":
      if (s.format === "groups" || s.format === "swiss")
        return n > m ? null : "Todos pasan a playoffs"
      if (s.format === "rr") return n >= 4 ? null : "Hacen falta 4 equipos"
      return n >= 17
        ? null
        : `En ${fmt} con ${n} equipos todos tienen un escalón propio`
  }
}

export type Result = Natural & {
  team: string
  pin: PinTier | null
  metal: PinMetal | null
  why: string | null
}

export function award(s: Setup, c: PinsConfig): Result[] {
  const n = s.teams
  const ok = (t: PinTier): string | null => {
    if (!c.enabled) return "Pines apagados en este torneo"
    const cfg = c.tiers[t]
    if (!cfg.on) return "Escalón apagado"
    if (cfg.min && n < cfg.min) return `Pide ${cfg.min} equipos (jugaron ${n})`
    return null
  }
  return naturalPlaces(s).map((p, i) => {
    let tier = p.tier
    // Única bajada: el 3.º sin "Tercer puesto" recibe "Semifinalista" (si hubo semifinales).
    if (
      tier === "third" &&
      ok("third") &&
      tierExists("semifinalist", s) === null
    )
      tier = "semifinalist"
    const why = ok(tier)
    return {
      ...p,
      team: `Equipo ${i + 1}`,
      pin: why ? null : tier,
      metal: why ? null : c.tiers[tier].metal,
      why,
    }
  })
}

export const FORMAT_LABEL: Record<Format, string> = {
  single: "Eliminación simple",
  double: "Doble eliminación",
  groups: "Grupos + playoffs",
  rr: "Todos contra todos",
  swiss: "Suizo + playoffs",
}

export function summary(results: Result[]): string {
  const counts = new Map<PinTier, number>()
  for (const r of results)
    if (r.pin) counts.set(r.pin, (counts.get(r.pin) ?? 0) + 1)
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  if (!total) return "Con esta configuración no se reparte ningún pin."
  const parts = PIN_TIERS.filter((t) => counts.has(t.id)).map(
    (t) => `${counts.get(t.id)} ${t.name}`
  )
  return `Se reparten ${total} ${total === 1 ? "pin" : "pines"}: ${parts.join(", ")}.`
}
