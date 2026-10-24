import { describe, expect, it } from "vitest"

import { aliasFeedback } from "./alias"

const now = new Date(2026, 9, 18, 12, 0)
const base = {
  value: "Zeta",
  current: "Zeta",
  state: "idle" as const,
  changedAt: null,
  nextChangeAt: null,
  now,
}

describe("aliasFeedback", () => {
  it("sin cambios: texto de ayuda y no se puede guardar", () => {
    expect(aliasFeedback(base)).toMatchObject({
      message: "2 a 24 caracteres. Único en la web.",
      canSave: false,
      chip: null,
    })
  })

  it("disponible, en uso, corto y palabra no permitida", () => {
    expect(
      aliasFeedback({ ...base, value: "Nuevo", state: "available" })
    ).toMatchObject({
      message: "Disponible. Después de cambiarlo tendrás que esperar 15 días.",
      tone: "win",
      canSave: true,
    })
    expect(
      aliasFeedback({ ...base, value: "Kova", state: "taken" }).message
    ).toBe("Ese alias ya está en uso.")
    expect(aliasFeedback({ ...base, value: "Z", state: "short" }).message).toBe(
      "Entre 2 y 24 caracteres."
    )
    expect(
      aliasFeedback({ ...base, value: "x<y", state: "blocked" }).message
    ).toBe("Contiene una palabra no permitida.")
  })

  it("bloqueado 15 días después de cambiarlo", () => {
    const fb = aliasFeedback({
      ...base,
      changedAt: new Date(2026, 9, 18, 11, 0).toISOString(),
      nextChangeAt: new Date(2026, 10, 2, 11, 0).toISOString(),
    })
    expect(fb).toMatchObject({
      message:
        "Lo cambiaste hace un momento. Se puede cambiar una vez cada 15 días.",
      icon: "lock",
      canSave: false,
      chip: "Podrás cambiarlo el 2 nov",
    })
  })

  it("pasado el plazo muestra hace cuántos días fue el último cambio", () => {
    const fb = aliasFeedback({
      ...base,
      changedAt: new Date(2026, 9, 1).toISOString(),
      nextChangeAt: new Date(2026, 9, 16).toISOString(),
    })
    expect(fb.chip).toBe("Último cambio hace 17 días")
    expect(fb.icon).toBe("at")
  })
})
