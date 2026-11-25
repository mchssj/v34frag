import { describe, expect, it } from "vitest"

import type { EloConfig } from "../types"
import { simulate, weightOf } from "./formula"

const C: EloConfig = {
  base: 20,
  mult_win_min: 0.75,
  mult_win_max: 1.5,
  mult_loss_min: 0.5,
  mult_loss_max: 1.25,
  team_cap: 30,
  min_delta: 10,
  elo_floor: 100,
  min_pct: 35,
  full_pct: 90,
}
const full = { rounds: 24, total: 24 }

describe("simulate", () => {
  it("equipos parejos: ±20 con rating 1", () => {
    expect(
      simulate({ outcome: "win", prob: 0.5, rating: 1, ...full }, C).delta
    ).toBe(20)
    expect(
      simulate({ outcome: "loss", prob: 0.5, rating: 1, ...full }, C).delta
    ).toBe(-20)
  })

  it("el multiplicador sale del rating, con sus topes", () => {
    const win = (rating: number) =>
      simulate({ outcome: "win", prob: 0.5, rating, ...full }, C)
    expect(win(1.4).delta).toBe(28)
    expect(win(2).mult).toBe(1.5)
    expect(win(0.4).mult).toBe(0.75)
    const loss = (rating: number) =>
      simulate({ outcome: "loss", prob: 0.5, rating, ...full }, C)
    // Jugar bien al perder resta menos.
    expect(loss(1.3).delta).toBe(-14)
    expect(loss(0.4).mult).toBe(1.25)
  })

  it("tope: nadie pasa de 30", () => {
    const r = simulate({ outcome: "win", prob: 0.1, rating: 1.5, ...full }, C)
    expect(r.raw).toBe(54)
    expect(r.delta).toBe(30)
  })

  it("mínimo: ganar muy favorito da al menos 10, en proporción a lo jugado", () => {
    expect(
      simulate({ outcome: "win", prob: 0.95, rating: 1, ...full }, C).delta
    ).toBe(10)
    expect(
      simulate(
        { outcome: "win", prob: 0.95, rating: 1, rounds: 12, total: 24 },
        C
      ).delta
    ).toBe(5)
  })

  it("con menos del 35 % no cuenta; desde el 90 %, completo", () => {
    expect(weightOf(8, 24, C)).toBe(0)
    expect(weightOf(12, 24, C)).toBe(0.5)
    expect(weightOf(27, 30, C)).toBe(1)
    expect(
      simulate(
        { outcome: "loss", prob: 0.5, rating: 1, rounds: 8, total: 24 },
        C
      ).delta
    ).toBe(0)
  })

  it("el empate no tiene mínimo", () => {
    expect(
      simulate({ outcome: "draw", prob: 0.5, rating: 1.3, ...full }, C).delta
    ).toBe(0)
    expect(
      simulate({ outcome: "draw", prob: 0.7, rating: 1, ...full }, C).delta
    ).toBe(-8)
  })
})
