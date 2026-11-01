import { describe, expect, it } from "vitest"

import {
  adr,
  cancelReasonLabel,
  demoMb,
  demoStatus,
  hsPercent,
  nickOf,
  signed,
  tvAddress,
  tvUrl,
} from "./labels"

describe("demoStatus", () => {
  it("cada estado con su texto y su tono", () => {
    expect(demoStatus("uploaded")).toEqual({ label: "Disponible", tone: "up" })
    expect(demoStatus("pending")).toEqual({
      label: "Subiendo",
      tone: "pending",
    })
    expect(demoStatus("expired")).toEqual({ label: "Vencida", tone: "off" })
    expect(demoStatus("missing")).toEqual({
      label: "No encontrada",
      tone: "off",
    })
    expect(demoStatus("none")).toEqual({ label: "—", tone: "off" })
    expect(demoStatus("otro")).toEqual({ label: "—", tone: "off" })
  })
})

describe("cancelReasonLabel", () => {
  it("traduce los códigos de la API y deja el resto como texto libre", () => {
    expect(cancelReasonLabel("crash")).toBe("Interrumpida")
    expect(cancelReasonLabel("map_change")).toBe("Cambio de mapa")
    expect(cancelReasonLabel("abandoned")).toBe("Abandono")
    expect(cancelReasonLabel("Se fue la luz")).toBe("Se fue la luz")
    expect(cancelReasonLabel(null)).toBe("Sin motivo")
  })
})

describe("cálculos de la tabla", () => {
  it("nick: alias si tiene ficha, si no el nombre del juego", () => {
    expect(nickOf({ alias: "Zeta", game_nick: "zeta_cs" })).toBe("Zeta")
    expect(nickOf({ alias: null, game_nick: "zeta_cs" })).toBe("zeta_cs")
    expect(nickOf({ alias: null, game_nick: null })).toBe("Jugador")
  })

  it("HS % y ADR redondeados, null sin kills o sin rondas", () => {
    expect(hsPercent(7, 20)).toBe(35)
    expect(hsPercent(1, 3)).toBe(33)
    expect(hsPercent(0, 0)).toBeNull()
    expect(hsPercent(null, 10)).toBeNull()
    expect(adr(2150, 26)).toBe(83)
    expect(adr(500, 0)).toBeNull()
    expect(adr(null, 20)).toBeNull()
  })

  it("con signo y tamaño de la demo", () => {
    expect(signed(5)).toBe("+5")
    expect(signed(-3)).toBe("-3")
    expect(signed(0)).toBe("0")
    expect(demoMb(45 * 1_048_576)).toBe(45)
    expect(demoMb(1000)).toBe(1)
  })

  it("SourceTV", () => {
    const tv = { host: "45.235.98.12", port: 27020 }
    expect(tvAddress(tv)).toBe("45.235.98.12:27020")
    expect(tvUrl(tv)).toBe("steam://connect/45.235.98.12:27020")
  })
})
