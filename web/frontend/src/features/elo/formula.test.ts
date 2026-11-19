import { describe, expect, it } from "vitest"

import {
  breakdown,
  eloWeight,
  inputForProb,
  ncdf,
  pgRound,
  pgRoundEven,
} from "./formula"

// Ejemplos de docs/bitacora/2026-10-14-elo-participacion-y-sourcetv/DOCUMENTACION.md (MR15, 30 rondas).
const even = {
  mu_team: 25,
  mu_opp: 25,
  c: 10,
  rating: 1,
  total_rounds: 30,
  elo_before: 1000,
}

describe("fórmula de ELO", () => {
  it("Φ da los valores conocidos", () => {
    expect(ncdf(0)).toBeCloseTo(0.5, 6)
    expect(ncdf(1)).toBeCloseTo(0.841345, 5)
    expect(ncdf(-1.96)).toBeCloseTo(0.025, 3)
  })

  it("redondea como Postgres", () => {
    expect(pgRound(2.5)).toBe(3)
    expect(pgRound(-2.5)).toBe(-3)
    expect(pgRoundEven(2.5)).toBe(2)
    expect(pgRoundEven(3.5)).toBe(4)
    expect(pgRoundEven(-2.5)).toBe(-2)
    expect(pgRoundEven(-3.5)).toBe(-4)
    expect(pgRoundEven(2.4)).toBe(2)
  })

  it("peso por rondas como la tabla de la documentación", () => {
    const table: [number, number][] = [
      [10, 0],
      [11, 11],
      [15, 15],
      [20, 20],
      [26, 26],
      [27, 30],
      [30, 30],
    ]
    for (const [rounds, change] of table) {
      expect(breakdown({ ...even, result: 1, rounds }).delta).toBe(change)
    }
    expect(eloWeight(27, 30)).toBe(1)
  })

  it("con equipos parejos y rating 1 se gana o pierde la base", () => {
    expect(breakdown({ ...even, result: 1, rounds: 30 }).delta).toBe(30)
    expect(breakdown({ ...even, result: 0, rounds: 30 }).delta).toBe(-30)
    expect(breakdown({ ...even, result: 0.5, rounds: 30 }).delta).toBe(0)
  })

  it("el bonus por rating tiene tope de ±5", () => {
    const b = breakdown({ ...even, result: 1, rounds: 30, rating: 1.9 })
    expect(b.bonus_raw).toBe(9)
    expect(b.bonus).toBe(5)
    expect(b.delta).toBe(35)
  })

  it("el ganador suma al menos 1 aunque fuera muy favorito", () => {
    const b = breakdown({
      ...even,
      ...inputForProb(0.995),
      result: 1,
      rounds: 30,
      rating: 0.6,
    })
    expect(b.scaled).toBeLessThan(1)
    expect(b.delta).toBe(1)
    expect(b.min_rule).toBe(true)
  })

  it("el ELO no baja del piso", () => {
    const b = breakdown({ ...even, elo_before: 110, result: 0, rounds: 30 })
    expect(b.elo_after).toBe(100)
    expect(b.floor_rule).toBe(true)
  })
})
