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
  }

  it("acepta coma decimal solo en el bonus por rating", () => {
    expect(parseElo(ok).values?.bonus_factor).toBe(10.5)
    expect(parseElo({ ...ok, base: "30,5" }).errors.base).toMatch(/entero/)
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
