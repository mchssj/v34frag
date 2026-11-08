import { describe, expect, it } from "vitest"

import {
  designBody,
  fromTemplate,
  lookOf,
  problems,
  ruleOf,
  withTarget,
} from "./editor"

describe("editor de medallas", () => {
  it("cada plantilla trae su primer escalón y su dibujo", () => {
    expect(fromTemplate("hs_pct")).toMatchObject({
      target: 35,
      number: "35%",
      label: "HS",
      accent: "hs",
      metal: "bronce",
      title: "35 % de headshots",
    })
    expect(fromTemplate("podio")).toMatchObject({ target: 1, metal: "oro" })
  })

  it("el objetivo arrastra el título, el número y el metal del escalón", () => {
    const d = withTarget(fromTemplate("awp"), 1000)
    expect(d).toMatchObject({
      title: "1000 kills con AWP",
      number: "1000",
      metal: "oro",
    })
    const k = withTarget(fromTemplate("kills"), 10000)
    expect(k.number).toBe("10k")
    expect(k.title).toBe("10.000 kills")
    // Un número escrito a mano no se pisa.
    expect(
      withTarget(
        { ...fromTemplate("awp"), numMode: "custom", number: "★" },
        500
      ).number
    ).toBe("★")
  })

  it("el top cambia la banda; las de temporada muestran S1", () => {
    const t = withTarget(fromTemplate("top_temporada"), 20)
    expect(lookOf(t)).toMatchObject({ band: "TOP 20", label: "S1" })
  })

  it("reglas, límites y cuerpo para la API", () => {
    expect(ruleOf(fromTemplate("awp"))).not.toContain("2026-10-29")
    expect(ruleOf(fromTemplate("kda"))).toContain("al menos 20 mixes")
    expect(problems(withTarget(fromTemplate("podio"), 4))).toContain(
      "El podio es del puesto 1 al 3."
    )
    expect(problems({ ...fromTemplate("hs_pct"), number: "123456" })).toContain(
      "El número: hasta 5 caracteres."
    )
    // La plantilla de kills no tiene banda: no se manda.
    expect(designBody(fromTemplate("kills"))).toEqual({
      number: "1000",
      label: "KILLS",
      metal: "bronce",
      accent: "pistolas",
    })
  })
})
