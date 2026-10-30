import { describe, expect, it } from "vitest"

import {
  compareVersions,
  daysUntil,
  fmtBytes,
  isConfirmText,
  latestVersion,
  licenseLabel,
  signed,
} from "./format"

const NOW = new Date("2026-10-28T12:00:00Z")

describe("format de Administración", () => {
  it("la doble confirmación acepta mayúsculas y espacios en los bordes", () => {
    expect(isConfirmText("  Estoy Seguro ")).toBe(true)
    expect(isConfirmText("estoy")).toBe(false)
  })

  it("bytes en MB y GB, con coma decimal en los GB", () => {
    expect(fmtBytes(148 * 1024 * 1024)).toBe("148 MB")
    expect(fmtBytes(184.2 * 1024 ** 3)).toBe("184,2 GB")
    expect(fmtBytes(null)).toBe("—")
  })

  it("signo tipográfico en los cambios de ELO", () => {
    expect(signed(20)).toBe("+20")
    expect(signed(-20)).toBe("−20")
    expect(signed(0)).toBe("0")
  })

  it("compara versiones número por número y elige la más alta", () => {
    expect(compareVersions("2.10.0", "2.9.9")).toBeGreaterThan(0)
    expect(compareVersions("2.5", "2.5.0")).toBe(0)
    expect(latestVersion(["2.4.1", null, "2.5.0", "2.3.1"])).toBe("2.5.0")
    expect(latestVersion([null])).toBeNull()
  })

  it("días hasta una fecha", () => {
    expect(daysUntil("2026-11-02T12:00:00Z", NOW)).toBe(5)
    expect(daysUntil("2026-10-27T12:00:00Z", NOW)).toBe(-1)
  })

  it("licencia: por vencer en ámbar, vencida y revocada en rojo", () => {
    expect(licenseLabel("expiring", "2026-11-02T12:00:00Z", NOW)).toEqual({
      text: "Vence en 5 días",
      tone: "warn",
    })
    expect(licenseLabel("ok", null, NOW).text).toBe("Sin vencimiento")
    expect(licenseLabel("revoked", null, NOW).tone).toBe("danger")
    expect(licenseLabel("expired", "2026-10-20T12:00:00Z", NOW).tone).toBe(
      "danger"
    )
  })
})
