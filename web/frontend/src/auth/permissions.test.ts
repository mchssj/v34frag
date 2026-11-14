import { describe, expect, it } from "vitest"

import {
  canReviewClips,
  canManageClips,
  canSeeSupportActivity,
  canSupport,
  isSupportOnly,
  canAccessAdminSection,
  canBanPermanent,
  canCreateEvent,
  canSeeAdmin,
  eventApprover,
  homeAdminSection,
} from "./permissions"

describe("permisos de Administración", () => {
  it("el soporte entra a Baneos y Clips, y nada más (replanteo 117)", () => {
    expect(canSeeAdmin("support")).toBe(true)
    expect(homeAdminSection("support")).toBe("bans")
    for (const section of ["bans", "clips"] as const)
      expect(canAccessAdminSection("support", section)).toBe(true)
    for (const section of [
      "events",
      "teams",
      "users",
      "servers",
      "seasons",
      "maps",
      "ranking",
    ] as const)
      expect(canAccessAdminSection("support", section)).toBe(false)
    expect(isSupportOnly("support")).toBe(true)
    expect(isSupportOnly("moderator")).toBe(false)
    for (const r of ["support", "moderator", "admin"] as const)
      expect(canSupport(r)).toBe(true)
    expect(canSupport("organizer")).toBe(false)
    expect(canSupport("user")).toBe(false)
    expect(canReviewClips("support")).toBe(true)
    expect(canReviewClips("moderator")).toBe(true)
    expect(canReviewClips("admin")).toBe(true)
    expect(canReviewClips("organizer")).toBe(false)
    expect(canReviewClips("user")).toBe(false)
    expect(canManageClips("support")).toBe(false)
    expect(canManageClips("moderator")).toBe(false)
    expect(canManageClips("admin")).toBe(true)
    expect(canSeeSupportActivity("support")).toBe(false)
    expect(canSeeSupportActivity("moderator")).toBe(true)
    expect(canBanPermanent("support")).toBe(false)
  })

  it("el moderador ve Administración pero solo entra a Baneos, Torneos, Equipos y Clips", () => {
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
    // (replanteo 117) Clips: reprocesar, como el soporte.
    expect(canAccessAdminSection("moderator", "clips")).toBe(true)
    for (const section of ["seasons", "ranking"] as const) {
      expect(canAccessAdminSection("admin", section)).toBe(true)
      expect(canAccessAdminSection("moderator", section)).toBe(false)
    }
    expect(homeAdminSection("moderator")).toBe("bans")
    expect(homeAdminSection("organizer")).toBe("events")
  })

  it("(replanteo 84) el moderador crea torneos y lo suyo lo aprueba un admin", () => {
    expect(canCreateEvent("moderator")).toBe(true)
    expect(canCreateEvent("organizer")).toBe(true)
    expect(canCreateEvent("user")).toBe(false)
    expect(eventApprover("admin")).toBe("none")
    expect(eventApprover("moderator")).toBe("admin")
    expect(eventApprover("organizer")).toBe("staff")
  })

  it("los permanentes son solo del admin", () => {
    expect(canBanPermanent("admin")).toBe(true)
    expect(canBanPermanent("moderator")).toBe(false)
  })
})
