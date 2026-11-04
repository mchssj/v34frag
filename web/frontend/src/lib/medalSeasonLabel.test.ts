import { describe, expect, it } from "vitest"

import { withSeasonLabel } from "./medalSeasonLabel"

const svg = (id: string, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg"><g id="${id}"><rect x="104" y="56" width="52" height="22"/><text x="130" y="72.5" font-size="15">${label}</text></g></svg>`

const parse = (s: string) => new DOMParser().parseFromString(s, "image/svg+xml")

describe("withSeasonLabel", () => {
  it("cambia S1 por la temporada y deja el ancho mínimo si entra", () => {
    const doc = parse(withSeasonLabel(svg("etiqueta", "S1"), "S2"))
    expect(doc.querySelector("text")?.textContent).toBe("S2")
    expect(doc.querySelector("rect")?.getAttribute("width")).toBe("52.0")
  })

  it("agranda la etiqueta y achica la letra con un nombre largo", () => {
    const doc = parse(withSeasonLabel(svg("temporada", "S1"), "BETA"))
    expect(doc.querySelector("text")?.getAttribute("font-size")).toBe("11.5")
    expect(Number(doc.querySelector("rect")?.getAttribute("width"))).toBeGreaterThan(52)
    expect(doc.querySelector("text")?.getAttribute("y")).toBe("71.3")
  })

  it("no toca las etiquetas que no son de temporada", () => {
    const original = svg("etiqueta", "FUNDADOR")
    expect(withSeasonLabel(original, "S2")).toBe(original)
  })
})
