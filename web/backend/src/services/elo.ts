import { levelOf } from '../lib/db';

// Configuración del ELO y vista previa (plan docs/bitacora/2026-10-16-api-elo-config). Desde el replanteo 100
// (docs/bitacora/2026-11-09-elo-por-partida) la vista previa usa la fórmula por partida de elo_apply_match:
// base por la probabilidad (ELO visible promedio), multiplicador por el rating del mix, tope por equipo y mínimo.

export type EloConfig = {
  base: number;
  bonus_max: number;
  bonus_factor: number;
  elo_floor: number;
  start_elo: number;
  min_pct: number;
  full_pct: number;
  mult_win_min: number;
  mult_win_max: number;
  mult_loss_min: number;
  mult_loss_max: number;
  team_cap: number;
  min_delta: number;
};

/** Los valores por defecto de elo_config (los que usa el motor si la tabla no tiene fila). */
export const ELO_DEFAULTS: EloConfig = {
  base: 30, bonus_max: 5, bonus_factor: 10, elo_floor: 100, start_elo: 1000, min_pct: 35, full_pct: 90,
  mult_win_min: 0.75, mult_win_max: 1.5, mult_loss_min: 0.5, mult_loss_max: 1.25, team_cap: 30, min_delta: 10,
};

/**
 * round() de Postgres sobre numeric: los empates se alejan del cero.
 * Antes se corrige el error de coma flotante ((0.9 - 1) * 25 da -2.4999… en JavaScript y -2.5 exacto en numeric).
 */
const roundNumeric = (x: number, decimals = 0) => {
  const f = 10 ** decimals;
  const y = Math.round(x * f * 1e6) / 1e6;
  return (Math.sign(y) * Math.round(Math.abs(y))) / f;
};

/** round() de Postgres sobre double precision: los empates van al par. */
const roundDouble = (x: number) => {
  const r = Math.round(x);
  return r - x === 0.5 && r % 2 !== 0 ? r - 1 : r;
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** elo_weight: 0 debajo del mínimo, 1 desde el porcentaje completo y proporcional en el medio. */
export function weight(c: EloConfig, rounds: number, total: number): number {
  if (rounds <= 0 || total <= 0) return 0;
  if (rounds * 100 < c.min_pct * total) return 0;
  if (rounds * 100 >= c.full_pct * total) return 1;
  return rounds / total;
}

/** Probabilidad de ganar con `diff` puntos de ELO promedio a favor (Elo clásico), con 4 decimales como en la base. */
export function winProb(diff: number): number {
  return roundNumeric(1 / (1 + 10 ** (-diff / 400)), 4);
}

/** Multiplicador por el rating del mix: al ganar, el rating; al perder, 2 − rating; acotados y con 2 decimales. */
export function multiplier(c: EloConfig, won: boolean, rating: number): number {
  return roundNumeric(won ? clamp(rating, c.mult_win_min, c.mult_win_max) : clamp(2 - rating, c.mult_loss_min, c.mult_loss_max), 2);
}

/**
 * Cambio de ELO de un jugador en un mix terminado, como elo_apply_match (replanteo 100), suponiendo que es el que más
 * se mueve de su equipo (el tope lo deja en `team_cap`). `prob`: la de su equipo. `null` si no llega al mínimo de rondas.
 */
export function delta(c: EloConfig, won: boolean, rating = 1, rounds = 1, total = 1, prob = 0.5): number | null {
  const wt = weight(c, rounds, total);
  if (wt === 0) return null;
  const d0 = roundDouble(2 * c.base * ((won ? 1 : 0) - prob) * multiplier(c, won, rating) * wt);
  const d = Math.abs(d0) > c.team_cap ? roundNumeric(d0 * roundNumeric(c.team_cap / Math.abs(d0), 4)) : d0;
  const min = Math.max(roundDouble(c.min_delta * wt), 1);
  return won ? Math.max(d, min) : Math.min(d, -min);
}

const pair = (c: EloConfig, rating: number, rounds = 1, total = 1) => ({
  rating,
  win: delta(c, true, rating, rounds, total),
  lose: delta(c, false, rating, rounds, total),
});

/** Favorito o no: `diff` puntos de ELO promedio a favor, rating 1,00. */
const strength = (c: EloConfig, diff: number) => {
  const prob = winProb(diff);
  return { diff, prob, rating: 1, win: delta(c, true, 1, 1, 1, prob), lose: delta(c, false, 1, 1, 1, prob) };
};

/** Los ejemplos de la vista previa, con los valores que el admin está editando. */
export function preview(c: EloConfig) {
  const total = 30;
  return {
    even: pair(c, 1),
    high_rating: pair(c, 1.4),
    low_rating: pair(c, 0.6),
    top_rating: pair(c, 1.8),
    favorite: strength(c, 200),
    underdog: strength(c, -200),
    new_player: { elo: c.start_elo, level: levelOf(c.start_elo) },
    floor: c.elo_floor,
    participation: [10, 20, 27].map((rounds) => ({
      rounds,
      total,
      pct: Math.round((rounds * 100) / total),
      weight: Math.round(weight(c, rounds, total) * 100) / 100,
      ...pair(c, 1, rounds, total),
    })),
  };
}
