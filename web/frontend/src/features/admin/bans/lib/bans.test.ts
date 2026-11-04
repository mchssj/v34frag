import { describe, expect, it } from "vitest"

import { banExpiry, banOrigin, banSteps, canEditBan } from "./bans"
import type { Ban } from "../types"

describe("Baneos", () => {
  it("permanente sin fecha; con días, desde ahora", () => {
    const now = new Date("2026-10-28T12:00:00Z")
    expect(banExpiry("perm", "", now)).toBeNull()
    expect(banExpiry("7", "", now)).toBe("2026-11-04T12:00:00.000Z")
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
