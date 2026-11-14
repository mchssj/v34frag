import { describe, expect, it } from "vitest"

import {
  banExpiry,
  banOrigin,
  banRemaining,
  banSteps,
  canEditBan,
  supportBanLimit,
  supportQuotaText,
  validBanHours,
  validBanMinutes,
} from "./bans"
import { supportActionQuote, supportActionText } from "./support"
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

  // ---------- Soporte (replanteo 117) ----------

  it("el soporte solo cambia o levanta los que puso él", () => {
    const mine = b({ created_by: { id: "u-sop", alias: "Sop" } })
    expect(canEditBan(mine, false, "u-sop")).toBe(true)
    expect(canEditBan(mine, false, "u-otro")).toBe(false)
    expect(canEditBan(b({}), false, "u-sop")).toBe(false)
    expect(canEditBan(mine, false)).toBe(true)
  })

  it("minutos de 1 a 120, y el tope de 120 desde que lo puso", () => {
    expect([0, 1, 60, 120, 121, 1.5].map(validBanMinutes)).toEqual([
      false,
      true,
      true,
      true,
      false,
      false,
    ])
    expect(
      supportBanLimit({ created_at: "2026-11-13T20:00:00Z" }).toISOString()
    ).toBe("2026-11-13T22:00:00.000Z")
  })

  it("el cupo de la semana, en palabras", () => {
    expect(supportQuotaText(3)).toBe(
      "Le quedan 3 baneos de soporte de 3 esta semana."
    )
    expect(supportQuotaText(1)).toBe(
      "Le queda 1 baneo de soporte de 3 esta semana."
    )
    expect(supportQuotaText(0)).toMatch(/pásale el caso a un moderador/)
  })
})

describe("Actividad del soporte", () => {
  const a = (o: Record<string, unknown>) =>
    ({
      id: 1,
      created_at: "2026-11-13T20:00:00Z",
      actor: { id: "p1", alias: "Sop" },
      player: { id: "p2", alias: "Tóxico" },
      team: null,
      reason: null,
      target: {},
      ...o,
    }) as Parameters<typeof supportActionText>[0]
  const fmt = (iso: string) => `[${iso}]`

  it("cada acción en una frase", () => {
    expect(
      supportActionText(a({ action: "ban", target: { expires_at: "X" } }), fmt)
    ).toBe("baneó a Tóxico hasta el [X]")
    expect(supportActionText(a({ action: "ban_lift" }), fmt)).toBe(
      "levantó el baneo de Tóxico"
    )
    expect(
      supportActionText(
        a({
          action: "logo_remove",
          player: null,
          team: { id: "t", name: "Los Pibes" },
        }),
        fmt
      )
    ).toBe("quitó el logo de Los Pibes")
    expect(
      supportActionText(
        a({ action: "comment_report", target: { decision: "dismiss" } }),
        fmt
      )
    ).toBe("descartó una denuncia de un comentario del perfil de Tóxico")
    expect(
      supportActionText(
        a({ action: "ban", player: null, target: { nick: "Suelto" } }),
        fmt
      )
    ).toBe("baneó a Suelto")
  })

  it("cita el comentario solo en las acciones sobre comentarios", () => {
    expect(
      supportActionQuote(
        a({ action: "comment_delete", target: { body: "hola" } })
      )
    ).toBe("hola")
    expect(
      supportActionQuote(a({ action: "ban", target: { body: "hola" } }))
    ).toBeNull()
  })
})
