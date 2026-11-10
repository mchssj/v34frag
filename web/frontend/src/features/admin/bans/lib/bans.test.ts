import { describe, expect, it } from "vitest"

import {
  banExpiry,
  banOrigin,
  banRemaining,
  banSteps,
  canEditBan,
  validBanHours,
} from "./bans"
import type { Ban } from "../types"

describe("Baneos", () => {
  it("permanente sin fecha; con días, desde ahora", () => {
    const now = new Date("2026-10-28T12:00:00Z")
    expect(banExpiry("perm", "", now)).toBeNull()
    expect(banExpiry("7", "", now)).toBe("2026-11-04T12:00:00.000Z")
  })

  it("por horas: las que se escriben, de 1 a 72", () => {
    const now = new Date("2026-10-28T12:00:00Z")
    expect(banExpiry("hours", "", now, 1)).toBe("2026-10-28T13:00:00.000Z")
    expect(banExpiry("hours", "", now, 5)).toBe("2026-10-28T17:00:00.000Z")
    expect(banExpiry("hours", "", now, 36)).toBe("2026-10-30T00:00:00.000Z")
    expect([1, 5, 72].every(validBanHours)).toBe(true)
    expect([0, -1, 73, 1.5, NaN].some(validBanHours)).toBe(false)
  })

  it("lo que falta: minutos, horas o días", () => {
    const now = new Date("2026-10-28T12:00:00Z")
    expect(banRemaining("2026-10-28T12:20:00Z", now)).toBe("en 20 min")
    expect(banRemaining("2026-10-28T13:00:00Z", now)).toBe("en 1 hora")
    expect(banRemaining("2026-10-28T18:00:00Z", now)).toBe("en 6 horas")
    expect(banRemaining("2026-10-29T12:00:00Z", now)).toBe("mañana")
    expect(banRemaining("2026-11-04T12:00:00Z", now)).toBe("en 7 días")
  })

  const b = (o: Partial<Ban>) =>
    ({
      id: "b1",
      created_by: { id: null, alias: "Halcón" },
      server: null,
      source: "web",
      status: "active",
      permanent: false,
      created_at: "2026-10-20T12:00:00Z",
      expires_at: "2026-10-30T12:00:00Z",
      lifted: null,
      ...o,
    }) as Ban

  it("origen según de dónde vino", () => {
    expect(banOrigin(b({ source: "web" }))).toMatchObject({
      label: "Web",
      by: "Halcón",
    })
    expect(
      banOrigin(b({ source: "server", server: { id: "s", name: "RBK" } }))
    ).toMatchObject({ label: "!ban · RBK", by: "Halcón" })
    expect(banOrigin(b({ source: "import" })).label).toBe("Importado")
  })

  it("qué pasó: cómo terminó o cuándo termina", () => {
    const last = (o: Partial<Ban>) => banSteps(b(o)).at(-1)
    expect(last({})?.title).toBe("Vence")
    expect(last({ permanent: true, expires_at: null })?.title).toBe("No vence")
    expect(last({ status: "expired" })?.title).toBe("Venció")
    const lifted = {
      at: "2026-10-21T12:00:00Z",
      reason: "Error",
      by: { id: null, alias: "Tiza" },
      replaced_by: null,
    }
    expect(last({ status: "lifted", lifted })?.text).toBe("Por Tiza: Error")
    expect(
      last({ status: "lifted", lifted: { ...lifted, replaced_by: "b2" } })
    ).toMatchObject({ title: "Reemplazado", replacedBy: "b2" })
  })

  it("el moderador no cambia ni levanta un permanente; nadie toca uno terminado", () => {
    const perm = b({ permanent: true, expires_at: null })
    expect(canEditBan(perm, false)).toBe(false)
    expect(canEditBan(perm, true)).toBe(true)
    expect(canEditBan(b({}), false)).toBe(true)
    expect(canEditBan(b({ status: "expired" }), true)).toBe(false)
  })
})
