import { describe, expect, it } from "vitest"

import { parseElo } from "./eloRules"

describe("Reglas del ELO", () => {
  const ok = {
    base: "30",
    bonus_max: "5",
    bonus_factor: "10,5",
    elo_floor: "100",
    start_elo: "1000",
    min_pct: "35",
    full_pct: "90",
    mult_win_min: "0,75",
    mult_win_max: "1,5",
    mult_loss_min: "0,5",
    mult_loss_max: "1,25",
    team_cap: "30",
    min_delta: "10",
  }

  it("acepta coma decimal en el bonus y en los multiplicadores", () => {
    const v = parseElo(ok).values
    expect(v?.bonus_factor).toBe(10.5)
    expect(v?.mult_win_min).toBe(0.75)
    expect(v?.mult_loss_max).toBe(1.25)
    expect(parseElo({ ...ok, base: "30,5" }).errors.base).toMatch(/entero/)
    expect(parseElo({ ...ok, min_delta: "10,5" }).errors.min_delta).toMatch(
      /entero/
    )
  })

  it("multiplicadores, tope y mínimo", () => {
    expect(parseElo({ ...ok, mult_win_min: "0,05" }).errors.mult_win_min).toBe(
      "Entre 0,1 y 1."
    )
    expect(parseElo({ ...ok, mult_loss_max: "3,5" }).errors.mult_loss_max).toBe(
      "Entre 1 y 3."
    )
    expect(parseElo({ ...ok, team_cap: "4" }).errors.team_cap).toBe(
      "Entre 5 y 200."
    )
    expect(
      parseElo({ ...ok, min_delta: "35", team_cap: "30" }).errors.min_delta
    ).toBe("No puede pasar el tope por equipo.")
  })

  it("respeta los rangos y las relaciones del contrato", () => {
    expect(parseElo({ ...ok, base: "4" }).errors.base).toBe("Entre 5 y 100.")
    expect(
      parseElo({ ...ok, start_elo: "100", elo_floor: "200" }).errors.start_elo
    ).toBeDefined()
    expect(parseElo({ ...ok, full_pct: "30" }).errors.full_pct).toBeDefined()
    expect(parseElo({ ...ok, min_pct: "" }).values).toBeNull()
  })
})
