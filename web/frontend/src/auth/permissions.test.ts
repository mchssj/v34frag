import { describe, expect, it } from "vitest"

import {
  canAccessAdminSection,
  canBanPermanent,
  canSeeAdmin,
  homeAdminSection,
} from "./permissions"

describe("permisos de Administración", () => {
  it("el moderador ve Administración pero solo entra a Baneos, Torneos y Equipos", () => {
    expect(canSeeAdmin("moderator")).toBe(true)
    expect(canAccessAdminSection("moderator", "bans")).toBe(true)
    expect(canAccessAdminSection("moderator", "events")).toBe(true)
    expect(canAccessAdminSection("moderator", "teams")).toBe(true)
    expect(canAccessAdminSection("moderator", "users")).toBe(false)
    expect(canAccessAdminSection("moderator", "servers")).toBe(false)
    expect(canAccessAdminSection("admin", "bans")).toBe(true)
    expect(canAccessAdminSection("admin", "maps")).toBe(true)
    expect(canAccessAdminSection("moderator", "maps")).toBe(false)
    expect(canAccessAdminSection("organizer", "maps")).toBe(false)
    for (const section of ["seasons", "clips", "ranking"] as const) {
      expect(canAccessAdminSection("admin", section)).toBe(true)
      expect(canAccessAdminSection("moderator", section)).toBe(false)
    }
    expect(homeAdminSection("moderator")).toBe("bans")
    expect(homeAdminSection("organizer")).toBe("events")
  })

  it("los permanentes son solo del admin", () => {
    expect(canBanPermanent("admin")).toBe(true)
    expect(canBanPermanent("moderator")).toBe(false)
  })
})
