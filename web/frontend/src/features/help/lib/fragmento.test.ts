import { describe, expect, it } from "vitest"

import { fragmento } from "./fragmento"
import { normalize } from "./links"

describe("fragmento", () => {
  it("devuelve lo buscado con su contexto, respetando las tildes del original", () => {
    expect(fragmento("Pausa táctica para tu equipo", normalize("TACTICA"))).toEqual({
      antes: "Pausa ",
      match: "táctica",
      despues: " para tu equipo",
    })
  })

  it("en un texto largo corta en espacios y marca los cortes", () => {
    const relleno = "palabra ".repeat(20)
    const f = fragmento(`${relleno}!calladmin ${relleno}`, "!calladmin")!
    expect(f.match).toBe("!calladmin")
    expect(f.antes.startsWith("…palabra")).toBe(true)
    expect(f.despues.endsWith("palabra…")).toBe(true)
  })

  it("null si no está o si no se buscó nada", () => {
    expect(fragmento("Texto.", "pause")).toBeNull()
    expect(fragmento("Texto.", "")).toBeNull()
  })
})
