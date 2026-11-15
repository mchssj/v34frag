import type { PinsConfig, PinsConfigInput } from "./api"
import type { PinAward, PinTier } from "./pinSvg"

// Los mismos valores por defecto que pins_default() en la base (replanteo 123).
export const DEFAULT_PINS: PinsConfig = {
  enabled: true,
  style: "anillos",
  tiers: {
    champion: { on: true, metal: "oro", min_teams: null },
    finalist: { on: true, metal: "plata", min_teams: null },
    third: { on: true, metal: "bronce", min_teams: null },
    semifinalist: { on: true, metal: "bronce", min_teams: 4 },
    quarter: { on: true, metal: "acero", min_teams: 8 },
    round16: { on: false, metal: "acero", min_teams: 16 },
    participant: { on: false, metal: "acero", min_teams: 8 },
  },
  awards: {
    mvp: { on: true, mode: "auto" },
    top_fragger: { on: true, mode: "auto" },
    awp: { on: true, mode: "auto" },
    clutch: { on: true, mode: "auto" },
    hs: { on: true, mode: "auto" },
    adr: { on: false, mode: "auto" },
    entry: { on: false, mode: "auto" },
    play: { on: false, mode: "pick" },
  },
}

export const TIER_ORDER: PinTier[] = [
  "champion",
  "finalist",
  "third",
  "semifinalist",
  "quarter",
  "round16",
  "participant",
]
export const AWARD_ORDER: PinAward[] = [
  "mvp",
  "top_fragger",
  "awp",
  "clutch",
  "hs",
  "adr",
  "entry",
  "play",
]

/** events.pins con lo que falta completado, como pins_config() en la base. */
export function pinsConfig(
  custom: PinsConfigInput | null | undefined
): PinsConfig {
  const c = custom ?? {}
  return {
    enabled: c.enabled ?? DEFAULT_PINS.enabled,
    style: c.style ?? DEFAULT_PINS.style,
    tiers: Object.fromEntries(
      TIER_ORDER.map((t) => [t, { ...DEFAULT_PINS.tiers[t], ...c.tiers?.[t] }])
    ) as PinsConfig["tiers"],
    awards: Object.fromEntries(
      AWARD_ORDER.map((a) => [
        a,
        {
          ...DEFAULT_PINS.awards[a],
          ...c.awards?.[a],
          ...(a === "play" ? { mode: "pick" as const } : {}),
        },
      ])
    ) as PinsConfig["awards"],
  }
}

/** Qué escalones no existen con este formato (la razón), para mostrarlos apagados. */
export function tierUnavailable(
  tier: PinTier,
  template: string,
  config: {
    third_place?: boolean
    groups?: number
    advance?: number
    playoffs?: { third_place?: boolean }
  },
  teams: number | null
): string | null {
  // Liga: un grupo del que sale un solo clasificado (el campeón). Ahí el 3.º es el de la tabla.
  const league =
    template === "groups" && config.groups === 1 && config.advance === 1
  const thirdMatch =
    template === "double" ||
    league ||
    (template === "single"
      ? !!config.third_place
      : !!config.playoffs?.third_place)
  if (tier === "third" && !thirdMatch)
    return "Solo con partido por el 3.er puesto o en doble eliminación"
  if (tier === "participant" && template === "single" && (teams ?? 0) <= 16)
    return "En eliminación simple, solo con más de 16 equipos"
  if (teams !== null) {
    if (tier === "quarter" && teams < 5)
      return `Con ${teams} equipos no hay cuartos`
    if (tier === "round16" && teams < 9)
      return `Con ${teams} equipos no hay octavos`
  }
  return null
}
