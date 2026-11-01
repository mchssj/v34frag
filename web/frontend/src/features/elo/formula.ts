// La fórmula de elo_apply_match (supabase/migrations/20261014120000_elo_participacion.sql) paso por paso,
// para mostrarle a cada jugador de dónde sale su cambio de ELO (docs/bitacora/2026-10-29-desglose-elo en
// kyan/pruebas). Si cambia la función de la base, hay que cambiar esto también.

export interface EloConfig {
  base: number
  bonus_max: number
  bonus_factor: number
  elo_floor: number
  min_pct: number
  full_pct: number
}

/** Valores por defecto de `elo_config`. */
export const DEFAULT_CONFIG: EloConfig = {
  base: 30,
  bonus_max: 5,
  bonus_factor: 10,
  elo_floor: 100,
  min_pct: 35,
  full_pct: 90,
}

/** 1 ganó, 0 perdió, 0.5 empate. */
export type MatchResult = 1 | 0 | 0.5

// Redondeos de Postgres (Math.round de JS manda los .5 hacia +∞, −2.5 → −2):
// round(numeric) aleja los .5 del cero; round(double precision) los manda al par (2.5 → 2, 3.5 → 4).
export const pgRound = (x: number) => Math.sign(x) * Math.round(Math.abs(x))
export function pgRoundEven(x: number) {
  const r = Math.round(x)
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r
}

/** Función de distribución normal estándar (Φ), como csstv_ncdf. */
export function ncdf(x: number) {
  // Aproximación de Abramowitz y Stegun 7.1.26 sobre erf, error < 1.5e-7.
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2))
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-(x * x) / 2)
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2
}

/** Peso por participación (elo_weight): con enteros, así 27 de 30 es exactamente 90 %. */
export function eloWeight(
  rounds: number,
  total: number,
  cfg: EloConfig = DEFAULT_CONFIG
) {
  if (total <= 0) return 0
  if (rounds * 100 < cfg.min_pct * total) return 0
  if (rounds * 100 >= cfg.full_pct * total) return 1
  return rounds / total
}

export interface BreakdownInput {
  elo_before: number
  /** Fuerza (Σ peso × μ) de tu equipo y del rival, y la incertidumbre c del partido. */
  mu_team: number
  mu_opp: number
  c: number
  result: MatchResult
  rating: number | null
  rounds: number
  total_rounds: number
}

export interface Breakdown {
  win_prob: number
  base: number
  bonus: number
  bonus_raw: number
  weight: number
  scaled: number
  /** Cambio después de la regla de mínimo ±1. */
  delta: number
  min_rule: boolean
  elo_after: number
  floor_rule: boolean
}

/** Cada paso del cálculo de un jugador en un mix, con los mismos redondeos que la base. */
export function breakdown(
  i: BreakdownInput,
  cfg: EloConfig = DEFAULT_CONFIG
): Breakdown {
  const win_prob = ncdf((i.mu_team - i.mu_opp) / i.c)
  // double precision (la probabilidad es double): al par.
  const base = pgRoundEven(2 * cfg.base * (i.result - win_prob))
  // numeric (rating y bonus_factor son numeric): lejos del cero.
  const bonus_raw = pgRound(((i.rating ?? 1) - 1) * cfg.bonus_factor)
  const bonus = Math.max(-cfg.bonus_max, Math.min(cfg.bonus_max, bonus_raw))
  const weight = eloWeight(i.rounds, i.total_rounds, cfg)
  // double precision (el peso es double): al par.
  const scaled = pgRoundEven((base + bonus) * weight)
  let delta = scaled
  if (weight > 0 && i.result === 1) delta = Math.max(delta, 1)
  if (weight > 0 && i.result === 0) delta = Math.min(delta, -1)
  // Peso 0: el jugador no recibe ELO (elo_apply_match ni lo toma).
  if (weight === 0) delta = 0
  const raw_after = i.elo_before + delta
  const elo_after = Math.max(cfg.elo_floor, raw_after)
  return {
    win_prob,
    base,
    bonus,
    bonus_raw,
    weight,
    scaled,
    delta: elo_after - i.elo_before,
    min_rule: delta !== scaled,
    elo_after,
    floor_rule: raw_after < cfg.elo_floor,
  }
}

/** Fuerzas de ejemplo para una probabilidad dada (para el simulador): μ rival 0 y c 1. */
export function inputForProb(
  p: number
): Pick<BreakdownInput, "mu_team" | "mu_opp" | "c"> {
  // Inversa de Φ por bisección: alcanza para un slider.
  let lo = -6
  let hi = 6
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2
    if (ncdf(mid) < p) lo = mid
    else hi = mid
  }
  return { mu_team: (lo + hi) / 2, mu_opp: 0, c: 1 }
}
