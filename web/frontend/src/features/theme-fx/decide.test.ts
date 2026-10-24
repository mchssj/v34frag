import { describe, expect, it } from "vitest"

import { decideFx } from "./decide"

const base = {
  isDark: false,
  systemDark: false,
  pref: "full" as const,
  busy: false,
  reducedMotion: false,
}

describe("decideFx", () => {
  it("flashbang solo al elegir Claro desde oscuro", () => {
    expect(decideFx({ ...base, target: "light", isDark: true })).toBe(
      "flashbang"
    )
    expect(decideFx({ ...base, target: "light", isDark: false })).toBe("direct")
    // Sistema en claro desde oscuro: cambio directo, como en el prototipo.
    expect(
      decideFx({ ...base, target: "system", isDark: true, systemDark: false })
    ).toBe("direct")
  })

  it("smoke al pasar de claro a oscuro (Oscuro, o Sistema con el sistema en oscuro)", () => {
    expect(decideFx({ ...base, target: "dark" })).toBe("smoke")
    expect(decideFx({ ...base, target: "system", systemDark: true })).toBe(
      "smoke"
    )
    expect(decideFx({ ...base, target: "dark", isDark: true })).toBe("direct")
  })

  it("sin preferencia pregunta, solo cuando habría efecto", () => {
    expect(decideFx({ ...base, target: "dark", pref: null })).toBe("ask")
    expect(decideFx({ ...base, target: "light", pref: null })).toBe("direct")
  })

  it("off, un efecto en curso o movimiento reducido: directo y sin modal", () => {
    expect(decideFx({ ...base, target: "dark", pref: "off" })).toBe("direct")
    expect(decideFx({ ...base, target: "dark", busy: true })).toBe("direct")
    expect(
      decideFx({ ...base, target: "dark", pref: null, reducedMotion: true })
    ).toBe("direct")
  })

  it("silent también lanza el efecto (sin sonido)", () => {
    expect(
      decideFx({ ...base, target: "light", isDark: true, pref: "silent" })
    ).toBe("flashbang")
  })
})
