import { describe, expect, it } from "vitest"

import { safeRedirect } from "./redirect"

describe("safeRedirect", () => {
  it.each([
    ["/panel", "/panel"],
    ["/completar-perfil?paso=redes", "/completar-perfil?paso=redes"],
    ["/jugador/123#partidas", "/jugador/123#partidas"],
  ])("acepta la ruta interna %s", (input, expected) => {
    expect(safeRedirect(input)).toBe(expected)
  })

  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/..//evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
    undefined,
    123,
  ])("rechaza %j", (input) => {
    expect(safeRedirect(input)).toBe("/")
  })

  it("usa el fallback indicado", () => {
    expect(safeRedirect("//evil.com", "/panel")).toBe("/panel")
  })
})
