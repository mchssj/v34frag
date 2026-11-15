import { beforeEach, describe, expect, it } from "vitest"

import {
  guidePending,
  guideSteps,
  markGuidePending,
  markGuideSeen,
} from "./guide"
import { GUIDE_LANGS } from "./guideText"
import { CLIENTMOD } from "@/config/site"

describe("guideSteps", () => {
  it("el jugador ve los pasos de siempre, terminando en Ayuda", () => {
    const keys = guideSteps("user").map((s) => s.key)
    expect(keys).not.toContain("admin")
    expect(keys.at(-1)).toBe("help")
  })

  it("el staff suma Administración antes de Ayuda, en su primera sección", () => {
    const steps = guideSteps("moderator")
    expect(steps.map((s) => s.key).slice(-2)).toEqual(["admin", "help"])
    expect(steps.at(-2)?.to).toBe("/admin/bans")
    expect(guideSteps("organizer").at(-2)?.to).toBe("/admin/events")
  })
})

describe("idiomas", () => {
  it("los tres tienen los mismos pasos, con texto", () => {
    for (const lang of GUIDE_LANGS) {
      const steps = guideSteps("admin", lang)
      expect(steps.map((s) => s.key)).toEqual(
        guideSteps("admin").map((s) => s.key)
      )
      for (const s of steps) expect(s.title && s.body).toBeTruthy()
      expect(steps[1].ask?.fix.download?.href).toBe(CLIENTMOD.downloadUrl)
    }
  })
})

describe("marcas de la guía", () => {
  beforeEach(() => localStorage.clear())

  it("sin pasar por la Bienvenida no se abre sola", () => {
    expect(guidePending("u1")).toBe(false)
  })

  it("queda pendiente al entrar a la Bienvenida y deja de estarlo al verla", () => {
    markGuidePending("u1")
    expect(guidePending("u1")).toBe(true)
    expect(guidePending("u2")).toBe(false)
    markGuideSeen("u1")
    expect(guidePending("u1")).toBe(false)
  })

  it("volver a la Bienvenida no la reabre si ya se vio", () => {
    markGuideSeen("u1")
    markGuidePending("u1")
    expect(guidePending("u1")).toBe(false)
  })
})
