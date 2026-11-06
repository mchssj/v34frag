import { describe, expect, it } from "vitest"

import { applyDesign } from "./svg"
import { METALS, TEMPLATES, defaultLook, templateOf } from "./templates"

// Los SVG reales de public/medallas (los de Kyan). Pruebas mínimas del plan, sección 13.
const FILES = import.meta.glob<string>("/public/medallas/**/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
})
const svgOf = (id: string) => FILES[`/public/medallas/${templateOf(id)!.svg}`]!
const render = (
  id: string,
  look: Parameters<typeof applyDesign>[1]["look"],
  locked = false,
  uid = "u1"
) =>
  applyDesign(svgOf(id), {
    look,
    template: templateOf(id)!,
    locked,
    uid,
    title: "Prueba",
  })

describe("applyDesign", () => {
  it("todas las plantillas del manifiesto tienen su SVG y se dibujan", () => {
    for (const t of TEMPLATES) {
      const el = render(t.id, defaultLook(t))
      expect(el.getAttribute("role")).toBe("img")
    }
  })

  it("id únicos por instancia, también en los url(#…)", () => {
    const a = render("hs_pct", defaultLook(templateOf("hs_pct")!), false, "a")
    const b = render("hs_pct", defaultLook(templateOf("hs_pct")!), false, "b")
    expect(a.querySelector('[id="a-metal"]')).not.toBeNull()
    expect(b.querySelector('[id="b-metal"]')).not.toBeNull()
    expect(a.querySelector('[id="metal"]')).toBeNull()
    expect(a.outerHTML).toContain("url(#a-metal)")
    expect(a.outerHTML).not.toContain("url(#metal)")
  })

  it("el tamaño del número sigue al largo", () => {
    const t = templateOf("kills")!
    const fs = (n: string) =>
      Number(
        render("kills", { ...defaultLook(t), number: n })
          .querySelector('[id="u1-numero"]')!
          .getAttribute("font-size")
      )
    expect(fs("7")).toBeGreaterThan(fs("70"))
    expect(fs("70")).toBeGreaterThan(fs("700"))
    expect(fs("7000")).toBeGreaterThan(fs("70000"))
    expect(
      render("kills", { ...defaultLook(t), number: "10k" }).querySelector(
        '[id="u1-numero"]'
      )!.textContent
    ).toBe("10k")
  })

  it("metal y rombos según el nivel; la etiqueta y su píldora", () => {
    const t = templateOf("hs_pct")!
    const el = render("hs_pct", {
      ...defaultLook(t),
      metal: "oro",
      label: "HEADSHOT",
    })
    const stops = [...el.querySelectorAll('[id="u1-metal"] stop')].map((s) =>
      s.getAttribute("stop-color")?.toUpperCase()
    )
    expect(stops[1]).toBe(METALS.oro.mid)
    const pips = [...el.querySelector('[id="u1-puntos-nivel"]')!.children]
    expect(
      pips.filter((p) => p.getAttribute("fill") === METALS.oro.mid)
    ).toHaveLength(3)
    const pill = el.querySelector('[id="u1-etiqueta"]')!
    expect(pill.querySelector("text")!.textContent).toBe("HEADSHOT")
    expect(
      Number(pill.querySelector("rect")!.getAttribute("width"))
    ).toBeGreaterThan(52)
  })

  it("bloqueada: gris, rombos apagados, número gris y lo dice", () => {
    const t = templateOf("victorias")!
    const el = render("victorias", defaultLook(t), true)
    expect(el.getAttribute("aria-label")).toBe("Prueba (bloqueada)")
    expect(el.getAttribute("style")).toContain("grayscale")
    const pips = [...el.querySelector('[id="u1-puntos-nivel"]')!.children]
    expect(pips.every((p) => p.getAttribute("fill") === "#24262D")).toBe(true)
    expect(el.querySelector('[id="u1-numero"]')!.getAttribute("fill")).toBe(
      "#A9ADB7"
    )
  })

  it("el podio toma el metal en toda la medalla y el número del puesto", () => {
    const t = templateOf("podio")!
    const el = render("podio", {
      ...defaultLook(t, 2),
      number: "2",
      metal: "plata",
      label: "S3",
    })
    expect(el.querySelector('[id="u1-numero"]')!.textContent).toBe("2")
    expect(el.outerHTML.toUpperCase()).not.toContain(METALS.oro.mid)
    expect(el.querySelector('[id="u1-temporada"] text')!.textContent).toBe("S3")
  })

  it("sin scripts ni eventos", () => {
    const t = templateOf("hs_pct")!
    const dirty = svgOf("hs_pct").replace(
      '<g id="cinta">',
      '<script>alert(1)</script><g id="cinta" onclick="alert(1)">'
    )
    const el = applyDesign(dirty, {
      look: defaultLook(t),
      template: t,
      uid: "x",
    })
    expect(el.querySelector("script")).toBeNull()
    expect(el.outerHTML).not.toContain("onclick")
  })
})
