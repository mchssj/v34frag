import { describe, expect, it } from "vitest"

import {
  codeReady,
  codesCsv,
  formatCode,
  prizeText,
  untilText,
  waitText,
} from "./codeFormat"

describe("formato del código", () => {
  it("CML: mayúsculas y guiones cada 4, lo pegue como lo pegue", () => {
    expect(formatCode("cml7k2mqx9p4htd")).toBe("CML-7K2M-QX9P-4HTD")
    expect(formatCode(" cml 7k2m-qx9p 4htd ")).toBe("CML-7K2M-QX9P-4HTD")
    expect(formatCode("CML-7K2")).toBe("CML-7K2")
    expect(formatCode("cml")).toBe("CML")
    expect(formatCode("cml7k2mqx9p4htdXYZ")).toBe("CML-7K2M-QX9P-4HTD")
  })

  it("personalizado: mayúsculas, sin caracteres raros y como lo escribió", () => {
    expect(formatCode("navidad-2026")).toBe("NAVIDAD-2026")
    expect(formatCode("navi<dad>!2026")).toBe("NAVIDAD2026")
    expect(formatCode("CM")).toBe("CM")
  })

  it("listo para mandar: CML completo o un personalizado de 8 o más", () => {
    expect(codeReady("CML-7K2M-QX9P-4HTD")).toBe(true)
    expect(codeReady("CML-7K2M-QX9P")).toBe(false)
    expect(codeReady("NAVIDAD-2026")).toBe(true)
    expect(codeReady("CORTO")).toBe(false)
  })
})

describe("textos", () => {
  const item = {
    id: "marco-mira",
    kind: "frame" as const,
    name: "Mira",
    file: null,
    css_class: null,
    animated: false,
    vip_only: false,
  }
  it("el premio en palabras", () => {
    expect(prizeText({ reward: "item", item, amount: null, days: null })).toBe(
      "Mira para siempre"
    )
    expect(prizeText({ reward: "item", item, amount: null, days: 1 })).toBe(
      "Mira por 1 día"
    )
    expect(
      prizeText({ reward: "points", item: null, amount: 1500, days: null })
    ).toBe(`${(1500).toLocaleString("es")} puntos`)
    expect(
      prizeText({ reward: "vip_coins", item: null, amount: 40, days: null })
    ).toBe("40 monedas VIP")
    expect(
      prizeText({ reward: "vip", item: null, amount: null, days: 30 })
    ).toBe("VIP por 30 días")
  })

  it("cuánto le queda", () => {
    const now = Date.parse("2026-11-16T12:00:00Z")
    expect(untilText("2026-11-21T13:00:00Z", now)).toBe("Vence en 5 días")
    expect(untilText("2026-11-16T20:00:00Z", now)).toBe("Vence hoy")
    expect(untilText("2026-11-12T12:00:00Z", now)).toMatch(/^Venció el 12/)
  })

  it("la espera del bloqueo", () => {
    expect(waitText(30)).toBe("1 minuto")
    expect(waitText(840)).toBe("14 minutos")
    expect(waitText(14400)).toBe("4 horas")
  })

  it("el CSV escapa las comillas", () => {
    expect(
      codesCsv(
        [{ code: "CML-AAAA-BBBB-CCCC" }],
        "500 puntos",
        'Sorteo "Navidad"'
      )
    ).toBe(
      'codigo,premio,sorteo\n"CML-AAAA-BBBB-CCCC","500 puntos","Sorteo ""Navidad"""'
    )
  })
})
