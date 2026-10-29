import { describe, expect, it } from "vitest"

import {
  canAccessAdminSection,
  canBanPermanent,
  canSeeAdmin,
  homeAdminSection,
} from "@/auth/permissions"
import { requestBlock } from "./players/SteamTabs"
import { adjustValueError, adjustedElo } from "./servers/AdjustmentsTab"
import { parseElo } from "./servers/EloRulesTab"
import { leadingSide } from "./servers/ReviewTab"
import { serverWarnings } from "./servers/ServersTab"
import type { AdminServer } from "./servers/queries"
import { banExpiry } from "./bans/BanDialog"
import { banOrigin, banSteps, canEditBan } from "./bans/bans"
import type { Ban } from "./bans/queries"
import type { SteamRequest } from "./players/queries"

const server = (o: Partial<AdminServer> = {}): AdminServer => ({
  id: "s1",
  name: "CMLeague #1",
  active: true,
  license_state: "ok",
  license_expires_at: null,
  allowed_ip: null,
  online: true,
  last_seen_at: "2026-10-28T11:57:00Z",
  last_ip: null,
  plugin_version: "2.5.0",
  connect_address: null,
  panel_server_id: null,
  mode: "mix",
  region: null,
  tv_port: null,
  matches: 10,
  last_match_at: null,
  created_at: "2026-10-01T00:00:00Z",
  ...o,
})

describe("permisos de Administración", () => {
  it("el moderador ve Administración pero solo entra a Baneos", () => {
    expect(canSeeAdmin("moderator")).toBe(true)
    expect(canAccessAdminSection("moderator", "bans")).toBe(true)
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

describe("Servidores", () => {
  it("sin avisos si está al día", () => {
    expect(serverWarnings(server(), "2.5.0")).toEqual([])
  })

  it("avisa sin señal, licencia por vencer y plugin viejo; nada si está revocado", () => {
    const w = serverWarnings(
      server({
        online: false,
        license_state: "expiring",
        plugin_version: "2.4.1",
      }),
      "2.5.0"
    )
    expect(w).toHaveLength(3)
    expect(
      serverWarnings(server({ active: false, online: false }), "2.5.0")
    ).toEqual([])
  })
})

describe("Reglas del ELO", () => {
  const ok = {
    base: "30",
    bonus_max: "5",
    bonus_factor: "10,5",
    elo_floor: "100",
    start_elo: "1000",
    min_pct: "35",
    full_pct: "90",
  }

  it("acepta coma decimal solo en el bonus por rating", () => {
    expect(parseElo(ok).values?.bonus_factor).toBe(10.5)
    expect(parseElo({ ...ok, base: "30,5" }).errors.base).toMatch(/entero/)
  })

  it("respeta los rangos y las relaciones del contrato", () => {
    expect(parseElo({ ...ok, base: "4" }).errors.base).toBe("Entre 5 y 100.")
    expect(
      parseElo({ ...ok, start_elo: "100", elo_floor: "200" }).errors.start_elo
    ).toBeDefined()
    expect(parseElo({ ...ok, full_pct: "30" }).errors.full_pct).toBeDefined()
    expect(parseElo({ ...ok, min_pct: "" }).values).toBeNull()
  })
})

describe("Ajustes manuales", () => {
  it("sumar o restar: de −500 a +500 sin 0; fijar: de 0 a 10000", () => {
    expect(adjustValueError("delta", "0")).not.toBeNull()
    expect(adjustValueError("delta", "-500")).toBeNull()
    expect(adjustValueError("delta", "501")).not.toBeNull()
    expect(adjustValueError("set", "10000")).toBeNull()
    expect(adjustValueError("set", "1,5")).not.toBeNull()
  })

  it("nadie baja del ELO mínimo", () => {
    expect(adjustedElo(120, "delta", -50, 100)).toBe(100)
    expect(adjustedElo(1480, "delta", 20, 100)).toBe(1500)
    expect(adjustedElo(1480, "set", 50, 100)).toBe(100)
  })
})

describe("Mixes por revisar", () => {
  it("gana el bando que iba adelante; empatados, nadie", () => {
    const side = (name: string, score: number) => ({ name, score })
    const m = { id: "m", map: null, played_at: null, starts_at: null }
    expect(
      leadingSide({ ...m, side1: side("Zeta", 9), side2: side("Vasco", 6) })
    ).toBe("Zeta")
    expect(
      leadingSide({ ...m, side1: side("Zeta", 7), side2: side("Vasco", 7) })
    ).toBeNull()
  })
})

describe("Pedidos de SteamID", () => {
  const req = (o: Partial<SteamRequest>): SteamRequest =>
    ({
      id: 1,
      kind: "add",
      steam_id: "76561198000000001",
      nick: null,
      status: "pending",
      note: null,
      reason: null,
      created_at: "2026-10-28T00:00:00Z",
      resolved_at: null,
      player: { id: "p", nick: "Tiza" },
      user: null,
      server: null,
      matches: 3,
      player_steam_count: 2,
      shares_match: false,
      ...o,
    }) as SteamRequest

  it("no se aprueba si comparte partidas o si es el único SteamID", () => {
    expect(requestBlock(req({}))).toBeNull()
    expect(requestBlock(req({ shares_match: true }))).not.toBeNull()
    expect(
      requestBlock(req({ kind: "remove", player_steam_count: 1 }))
    ).not.toBeNull()
    expect(
      requestBlock(req({ shares_match: true, status: "rejected" }))
    ).toBeNull()
  })
})

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
