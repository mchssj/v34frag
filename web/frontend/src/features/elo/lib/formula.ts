import type { EloConfig, Outcome } from "../types"

// La fórmula por partida (replanteo 100) para el simulador del desglose: lo ya jugado lo calcula la base (replanteo 142).
// Con los mismos redondeos que Postgres. Si cambia elo_apply_match, cambiar también esto. No incluye abandonos, el mínimo
// de ELO ni el tope cuando lo pasa un compañero.

/** round(numeric): los .5 se alejan del cero. */
const roundNumeric = (x: number) => Math.sign(x) * Math.round(Math.abs(x))
/** round(double precision): los .5 van al par. */
function roundDouble(x: number) {
  const r = Math.round(x)
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r
}

export interface SimInput {
  outcome: Outcome
  /** Probabilidad de ganar de tu equipo (0 a 1). */
  prob: number
  rating: number
  rounds: number
  total: number
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v))

/** Peso por las rondas jugadas (elo_weight). */
export function weightOf(rounds: number, total: number, c: EloConfig) {
  if (rounds <= 0 || total <= 0 || rounds * 100 < c.min_pct * total) return 0
  return rounds * 100 >= c.full_pct * total ? 1 : rounds / total
}

export function simulate(i: SimInput, c: EloConfig) {
  const res = i.outcome === "win" ? 1 : i.outcome === "loss" ? 0 : 0.5
  const base = 2 * c.base * (res - i.prob)
  const mult =
    res === 1
      ? clamp(i.rating, c.mult_win_min, c.mult_win_max)
      : res === 0
        ? clamp(2 - i.rating, c.mult_loss_min, c.mult_loss_max)
        : 1
  const weight = weightOf(i.rounds, i.total, c)
  const raw = roundDouble(base * mult * weight)
  const scale =
    Math.abs(raw) > c.team_cap
      ? Math.round((c.team_cap / Math.abs(raw)) * 1e4) / 1e4
      : 1
  const scaled = roundNumeric(raw * scale)
  const min = res === 0.5 ? 0 : Math.max(1, roundDouble(c.min_delta * weight))
  const delta =
    weight === 0
      ? 0
      : res === 1
        ? Math.max(scaled, min)
        : res === 0
          ? Math.min(scaled, -min)
          : scaled
  return { base, mult, weight, raw, scale, scaled, min, delta }
}
