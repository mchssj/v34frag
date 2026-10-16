import { levelOf } from '../lib/db';

// Configuración del ELO y vista previa (plan docs/bitacora/2026-10-16-api-elo-config).
// Las fórmulas son las de elo_apply_match con equipos parejos (probabilidad 0,5).

export type EloConfig = {
  base: number;
  bonus_max: number;
  bonus_factor: number;
  elo_floor: number;
  start_elo: number;
  min_pct: number;
  full_pct: number;
};

/** Los valores por defecto de elo_config (los que usa el motor si la tabla no tiene fila). */
export const ELO_DEFAULTS: EloConfig = { base: 30, bonus_max: 5, bonus_factor: 10, elo_floor: 100, start_elo: 1000, min_pct: 35, full_pct: 90 };

/**
 * round() de Postgres sobre numeric (el bonus: rating y factor son numeric): los empates se alejan del cero.
 * Antes se corrige el error de coma flotante ((0.9 - 1) * 25 da -2.4999… en JavaScript y -2.5 exacto en numeric).
 */
const roundNumeric = (x: number) => {
  const y = Math.round(x * 1e9) / 1e9;
  return Math.sign(y) * Math.round(Math.abs(y));
};

/** round() de Postgres sobre double precision (el peso de la participación): los empates van al par. */
const roundDouble = (x: number) => {
  const r = Math.round(x);
  return r - x === 0.5 && r % 2 !== 0 ? r - 1 : r;
};

/** elo_weight: 0 debajo del mínimo, 1 desde el porcentaje completo y proporcional en el medio. */
export function weight(c: EloConfig, rounds: number, total: number): number {
  if (rounds <= 0 || total <= 0) return 0;
  if (rounds * 100 < c.min_pct * total) return 0;
  if (rounds * 100 >= c.full_pct * total) return 1;
  return rounds / total;
}

/** Cambio de ELO de un jugador con equipos parejos. `null` si no llega al mínimo de rondas (no recibe ELO). */
export function delta(c: EloConfig, won: boolean, rating = 1, rounds = 1, total = 1): number | null {
  const wt = weight(c, rounds, total);
  if (wt === 0) return null;
  const base = won ? c.base : -c.base;
  const bonus = Math.max(-c.bonus_max, Math.min(c.bonus_max, roundNumeric((rating - 1) * c.bonus_factor)));
  const d = roundDouble((base + bonus) * wt);
  return won ? Math.max(d, 1) : Math.min(d, -1);
}

const pair = (c: EloConfig, rating: number, rounds = 1, total = 1) => ({
  rating,
  win: delta(c, true, rating, rounds, total),
  lose: delta(c, false, rating, rounds, total),
});

/** Los ejemplos de la vista previa, con los valores que el admin está editando. */
export function preview(c: EloConfig) {
  const total = 30;
  return {
    even: pair(c, 1),
    high_rating: pair(c, 1.4),
    low_rating: pair(c, 0.6),
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
