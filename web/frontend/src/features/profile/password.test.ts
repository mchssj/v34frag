import { describe, expect, it } from "vitest"

import {
  passwordChangedText,
  passwordFeedback,
  passwordScore,
} from "./password"

const base = {
  current: "vieja-123",
  next: "",
  confirm: "",
  tried: false,
  serverError: null,
} as const

describe("passwordScore", () => {
  it.each([
    ["", 0],
    ["abcdefgh", 1],
    ["Abcdefgh", 2],
    ["Abcdefg1", 3],
    ["Abcdef1!", 4],
    ["A1!", 3],
  ])("%s → %i", (q, score) => expect(passwordScore(q)).toBe(score))
})

describe("passwordFeedback", () => {
  it("sin escribir: ayuda y no se puede guardar", () => {
    const f = passwordFeedback(base)
    expect(f.next.message).toBe(
      "Usa al menos 8 caracteres, con números y mayúsculas."
    )
    expect(f.next.tone).toBe("muted")
    expect(f.confirm.message).toBeNull()
    expect(f.canSave).toBe(false)
  })

  it("la etiqueta sigue el puntaje", () => {
    expect(passwordFeedback({ ...base, next: "abc" }).next.message).toBe(
      "Muy débil"
    )
    expect(passwordFeedback({ ...base, next: "abcdefgh" }).next.message).toBe(
      "Débil"
    )
    expect(passwordFeedback({ ...base, next: "Abcdefgh" }).next.message).toBe(
      "Aceptable"
    )
    expect(passwordFeedback({ ...base, next: "Abcdef1!" }).next.message).toBe(
      "Fuerte"
    )
  })

  it("igual a la actual: error aunque no haya intentado guardar", () => {
    const f = passwordFeedback({ ...base, next: "vieja-123" })
    expect(f.next.message).toBe("Tiene que ser distinta de la actual.")
    expect(f.next.invalid).toBe(true)
  })

  it("coinciden / no coinciden recién al llegar al mismo largo", () => {
    const next = "Nueva-1234"
    expect(
      passwordFeedback({ ...base, next, confirm: "Nue" }).confirm.message
    ).toBeNull()
    expect(
      passwordFeedback({ ...base, next, confirm: "Nueva-1235" }).confirm
    ).toMatchObject({ message: "No coinciden", border: "destructive" })
    expect(
      passwordFeedback({ ...base, next, confirm: next }).confirm
    ).toMatchObject({ message: "Coinciden", tone: "win", border: "win" })
  })

  it("al intentar guardar muestra todos los errores", () => {
    const f = passwordFeedback({
      ...base,
      current: "",
      next: "abc",
      confirm: "x",
      tried: true,
    })
    expect(f.current.error).toBe("Ingresa tu contraseña actual.")
    expect(f.next.message).toBe(
      "Muy débil. Usa al menos 8 caracteres, con números o mayúsculas."
    )
    expect(f.confirm.message).toBe("No coinciden")
  })

  it("se puede guardar con la actual, una nueva válida y la repetición igual", () => {
    expect(
      passwordFeedback({ ...base, next: "Nueva-1234", confirm: "Nueva-1234" })
        .canSave
    ).toBe(true)
    // 8 caracteres solo con minúsculas: 1 punto, no alcanza.
    expect(
      passwordFeedback({ ...base, next: "abcdefgh", confirm: "abcdefgh" })
        .canSave
    ).toBe(false)
  })

  it("los rechazos del backend van en su campo", () => {
    expect(
      passwordFeedback({ ...base, serverError: "wrong" }).current.error
    ).toBe("La contraseña actual no es correcta.")
    const same = passwordFeedback({
      ...base,
      next: "Nueva-1234",
      confirm: "Nueva-1234",
      serverError: "same",
    })
    expect(same.next.message).toBe("Tiene que ser distinta de la actual.")
    expect(same.canSave).toBe(false)
  })
})

describe("passwordChangedText", () => {
  const now = new Date("2026-10-22T12:00:00Z")
  it("sin fecha no muestra nada", () => {
    expect(passwordChangedText(null, now)).toBeNull()
  })
  it("recién cambiada: hace un momento", () => {
    expect(passwordChangedText("2026-10-22T11:59:30Z", now)).toBe(
      "Último cambio hace un momento"
    )
  })
  it("después, el tiempo relativo", () => {
    expect(passwordChangedText("2026-10-19T12:00:00Z", now)).toBe(
      "Último cambio hace 3 días"
    )
  })
})
