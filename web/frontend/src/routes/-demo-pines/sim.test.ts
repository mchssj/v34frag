import { describe, expect, it } from "vitest"

import { DEFAULT_CONFIG, award, type PinsConfig, type Setup } from "./sim"

const base: Setup = { format: "single", teams: 8, third: false, playoff: 8 }
const pins = (s: Setup, c: PinsConfig = DEFAULT_CONFIG) =>
  award(s, c).map((r) => r.pin)
const off = (t: keyof PinsConfig["tiers"]): PinsConfig => ({
  ...DEFAULT_CONFIG,
  tiers: {
    ...DEFAULT_CONFIG.tiers,
    [t]: { ...DEFAULT_CONFIG.tiers[t], on: false },
  },
})

describe("reparto de pines", () => {
  it("un pin por equipo: el campeón no recibe el de finalista", () => {
    const r = award(base, DEFAULT_CONFIG)
    expect(r).toHaveLength(8)
    expect(r.filter((x) => x.pin === "champion")).toHaveLength(1)
    expect(r[0]!.pin).toBe("champion")
  })

  it("eliminación simple con 8: 1, 2, 2 semis y 4 cuartos", () => {
    expect(pins(base)).toEqual([
      "champion",
      "finalist",
      "semifinalist",
      "semifinalist",
      "quarter",
      "quarter",
      "quarter",
      "quarter",
    ])
  })

  it("con 4 equipos no hay cuartos y semifinalista pide 4", () => {
    expect(pins({ ...base, teams: 4 })).toEqual([
      "champion",
      "finalist",
      "semifinalist",
      "semifinalist",
    ])
    expect(pins({ ...base, teams: 3 })).toEqual(["champion", "finalist", null])
  })

  it("cuartos pide 8 equipos por defecto", () => {
    expect(pins({ ...base, teams: 6 }).slice(4)).toEqual([null, null])
  })

  it("partido por el 3.º: uno tercero y otro semifinalista", () => {
    expect(pins({ ...base, third: true }).slice(2, 4)).toEqual([
      "third",
      "semifinalist",
    ])
  })

  it("tercer puesto apagado: el 3.º baja a semifinalista", () => {
    expect(
      pins({ ...base, format: "double" }, off("third")).slice(2, 4)
    ).toEqual(["semifinalist", "semifinalist"])
  })

  it("otro escalón apagado no baja: queda sin pin", () => {
    expect(pins(base, off("finalist"))[1]).toBeNull()
  })

  it("grupos: los que no pasan son participantes (si está encendido)", () => {
    const s: Setup = { ...base, format: "groups", teams: 12, playoff: 4 }
    expect(pins(s).slice(4)).toEqual(Array(8).fill(null))
    const on: PinsConfig = {
      ...DEFAULT_CONFIG,
      tiers: {
        ...DEFAULT_CONFIG.tiers,
        participant: { on: true, metal: "acero", min: 8 },
      },
    }
    expect(pins(s, on).slice(4)).toEqual(Array(8).fill("participant"))
  })

  it("pines apagados: nadie recibe", () => {
    expect(
      pins(base, { ...DEFAULT_CONFIG, enabled: false }).every((p) => p === null)
    ).toBe(true)
  })
})
