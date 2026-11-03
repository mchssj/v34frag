import { describe, expect, it } from "vitest"

import { imageFile, linkKind, normalize } from "./links"

describe("links del manual", () => {
  it("distingue rutas de la web, links de afuera y lo demás", () => {
    expect(linkKind("/help/jugador/x")).toBe("internal")
    expect(linkKind("/play")).toBe("internal")
    expect(linkKind("https://discord.gg/x")).toBe("external")
    expect(linkKind("mailto:a@b.c")).toBe("external")
    expect(linkKind("//evil.com")).toBe("other")
    expect(linkKind("javascript:alert(1)")).toBe("other")
    expect(linkKind("#seccion")).toBe("other")
  })

  it("solo acepta capturas de img/ con nombre simple", () => {
    expect(imageFile("img/buscar-partida.webp")).toBe("buscar-partida.webp")
    expect(imageFile("img/../admin/x.webp")).toBeNull()
    expect(imageFile("https://x.com/a.png")).toBeNull()
    expect(imageFile("img/a.gif")).toBeNull()
  })

  it("busca sin tildes ni mayúsculas", () => {
    expect(normalize("Capitán")).toBe("capitan")
  })
})
