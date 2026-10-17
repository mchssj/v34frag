import { describe, expect, it } from "vitest"

import { maskEmail, passwordLabel, passwordScore } from "./helpers"
import { localAliasState } from "./useAliasStatus"

describe("passwordScore", () => {
  it.each([
    ["", 0],
    ["corta", 0],
    ["largaaaa", 1],
    ["Largaaaa", 2],
    ["Largaaa1", 3],
    ["Larga-a1", 4],
    ["A1!", 3],
  ])("%j → %i", (password, score) => {
    expect(passwordScore(password)).toBe(score)
  })
})

describe("passwordLabel", () => {
  it("vacío explica la regla; con texto usa la escala del diseño", () => {
    expect(passwordLabel("")).toBe(
      "Usa al menos 8 caracteres, con números y mayúsculas."
    )
    expect(passwordLabel("abc")).toBe("Muy débil")
    expect(passwordLabel("Larga-a1")).toBe("Fuerte")
  })
})

describe("maskEmail", () => {
  it.each([
    ["juan.perez@gmail.com", "ju••••••@gmail.com"],
    ["ana@mail.com", "an•@mail.com"],
    ["jo@x.co", "jo@x.co"],
    ["sin-arroba", "sin-arroba"],
  ])("%s → %s", (email, masked) => {
    expect(maskEmail(email)).toBe(masked)
  })
})

describe("localAliasState", () => {
  it("resuelve sin la API lo que no necesita consultarse", () => {
    expect(localAliasState("")).toBe("idle")
    expect(localAliasState("  ")).toBe("idle")
    expect(localAliasState("a")).toBe("short")
    expect(localAliasState("a<b")).toBe("blocked")
    expect(localAliasState("Mecha")).toBeNull()
  })
})
