import { describe, expect, it } from "vitest"

import { adjustValueError, adjustedElo } from "./adjustments"

describe("Ajustes manuales", () => {
  it("sumar o restar: de −500 a +500 sin 0; fijar: de 0 a 10000", () => {
    expect(adjustValueError("delta", "0")).not.toBeNull()
    expect(adjustValueError("delta", "-500")).toBeNull()
    expect(adjustValueError("delta", "501")).not.toBeNull()
    expect(adjustValueError("set", "10000")).toBeNull()
    expect(adjustValueError("set", "1,5")).not.toBeNull()
  })

  it("nadie baja del ELO mínimo", () => {
    expect(adjustedElo(120, "delta", -50, 100)).toBe(100)
    expect(adjustedElo(1480, "delta", 20, 100)).toBe(1500)
    expect(adjustedElo(1480, "set", 50, 100)).toBe(100)
  })
})
