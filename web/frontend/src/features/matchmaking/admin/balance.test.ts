import { describe, expect, it } from "vitest"

import { balanceAdjust } from "./balance"

const cfg = { weight: 200, cap: 100, prior: 5 }

describe("balanceAdjust", () => {
  it("da los ejemplos del plan (2026-11-04-mm-equipos-con-rating)", () => {
    expect(balanceAdjust(1.4, 20, cfg)).toBe(64)
    expect(balanceAdjust(0.8, 20, cfg)).toBe(-32)
    expect(balanceAdjust(1.9, 2, cfg)).toBe(51)
  })

  it("respeta el tope en los dos sentidos", () => {
    expect(balanceAdjust(3, 100, cfg)).toBe(100)
    expect(balanceAdjust(0, 100, cfg)).toBe(-100)
  })

  it("sin mapas ni corrección no ajusta", () => {
    expect(balanceAdjust(1.5, 0, { ...cfg, prior: 0 })).toBe(0)
  })
})
