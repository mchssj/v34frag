import { describe, expect, it } from "vitest"

import { leadingSide } from "./review"

describe("Mixes por revisar", () => {
  it("gana el bando que iba adelante; empatados, nadie", () => {
    const side = (name: string, score: number) => ({ name, score })
    const m = { id: "m", map: null, played_at: null, starts_at: null }
    expect(
      leadingSide({ ...m, side1: side("Zeta", 9), side2: side("Vasco", 6) })
    ).toBe("Zeta")
    expect(
      leadingSide({ ...m, side1: side("Zeta", 7), side2: side("Vasco", 7) })
    ).toBeNull()
  })
})
