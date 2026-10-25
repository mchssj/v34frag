import { describe, expect, it } from "vitest"

import {
  adjustmentLabel,
  faceitUrl,
  ladderState,
  legacyTeams,
  matchTitle,
  nextLevelText,
  resultOf,
  scoreOf,
  steamUrl,
  stintPeriod,
  stintRole,
  tilePct,
} from "./labels"
import type { EloAdjustment, PlayerMatch } from "./queries"
import { playerSearchSchema, toMatchesQuery } from "./search"

const match = (o: Partial<PlayerMatch> = {}): PlayerMatch => ({
  match_id: "m1",
  kind: "mix",
  played_at: "2026-10-24T21:30:00Z",
  map: "de_dust2",
  side1_name: "Bando Zeta",
  side2_name: "Bando Vasco",
  score1: 16,
  score2: 12,
  side: 1,
  won: true,
  parent_match_id: null,
  game_nick: "zeta",
  kills: 20,
  deaths: 14,
  assists: 3,
  headshots: 9,
  damage: 2200,
  rounds: 28,
  rating: 1.3,
  elo_before: 1500,
  elo_after: 1520,
  elo_delta: 20,
  demo_status: null,
  event: null,
  label: null,
  ...o,
})

describe("nivel", () => {
  it("lo que falta para el siguiente, o el máximo", () => {
    expect(nextLevelText(5, 1062)).toBe("Faltan 139 ELO para nivel 6 (1201).")
    expect(nextLevelText(10, 2300)).toBe("Nivel máximo alcanzado.")
  })
  it("escalera", () => {
    expect([1, 5, 6].map((n) => ladderState(n, 5))).toEqual([
      "done",
      "current",
      "next",
    ])
  })
})

describe("redes", () => {
  it("Steam solo con un link de steamcommunity.com, nunca un SteamID", () => {
    expect(steamUrl("steamcommunity.com/id/zeta")).toBe(
      "https://steamcommunity.com/id/zeta"
    )
    expect(
      steamUrl("https://steamcommunity.com/profiles/76561198000000000/")
    ).toBe("https://steamcommunity.com/profiles/76561198000000000")
    expect(steamUrl("STEAM_0:0:797529184")).toBeNull()
    expect(steamUrl("76561198000000000")).toBeNull()
    expect(steamUrl(null)).toBeNull()
  })
  it("FACEIT con el nick (web nueva) o el link completo (web vieja)", () => {
    expect(faceitUrl("kyantares")).toBe(
      "https://www.faceit.com/es/players/kyantares"
    )
    expect(faceitUrl("https://www.faceit.com/es/players/kyantares")).toBe(
      "https://www.faceit.com/es/players/kyantares"
    )
    expect(faceitUrl("no es un nick válido!")).toBeNull()
    expect(faceitUrl("")).toBeNull()
  })
})

describe("partidas", () => {
  it("marcador desde el lado del jugador", () => {
    expect(scoreOf(match())).toBe("16:12")
    expect(scoreOf(match({ side: 2 }))).toBe("12:16")
    expect(scoreOf(match({ score1: null }))).toBeNull()
  })
  it("título y subtítulo según el tipo", () => {
    expect(matchTitle(match())).toEqual({
      title: "Mix · de_dust2",
      sub: "24 oct · 16:12",
    })
    expect(
      matchTitle(
        match({
          kind: "official",
          event: { id: "e", name: "Copa Invierno" },
          label: "Final",
        })
      )
    ).toEqual({
      title: "Bando Zeta vs Bando Vasco",
      sub: "Copa Invierno · Final",
    })
    expect(matchTitle(match({ kind: "pcw" })).sub).toBe("PCW · de_dust2")
  })
  it("resultado", () => {
    expect([true, false, null].map(resultOf)).toEqual(["V", "D", "E"])
  })
})

describe("equipos", () => {
  it("rol con el vocabulario nuevo", () => {
    expect(stintRole("player", true)).toBe("Activo · líder")
    expect(stintRole("sub", false)).toBe("Suplente")
    expect(stintRole("coach", false)).toBe("Coach")
  })
  it("período", () => {
    expect(stintPeriod("2026-03-10T00:00:00Z", null)).toBe(
      "desde marzo de 2026"
    )
    expect(stintPeriod("2026-01-10T00:00:00Z", "2026-03-10T00:00:00Z")).toBe(
      "enero de 2026 – marzo de 2026"
    )
    expect(stintPeriod(null, null)).toBe("—")
  })
  it("historial escrito a mano en la web vieja", () => {
    expect(legacyTeams("ARVUM\nSOVIET\r\n  \nFOL")).toBe("ARVUM · SOVIET · FOL")
    expect(legacyTeams(null)).toBeNull()
  })
})

describe("otros", () => {
  it("ajustes de ELO", () => {
    const a = {
      id: 1,
      kind: "delta",
      delta: 20,
      set_elo: null,
      reason: "x",
      applied_at: "",
    } as EloAdjustment
    expect(adjustmentLabel(a)).toBe("+20")
    expect(adjustmentLabel({ ...a, delta: -5 })).toBe("-5")
    expect(adjustmentLabel({ ...a, kind: "set", set_elo: 1500 })).toBe(
      "Fijado en 1500"
    )
  })
  it("barras de los tiles", () => {
    expect(tilePct(1, 2)).toBe(50)
    expect(tilePct(3, 2)).toBe(100)
    expect(tilePct(null, 2)).toBe(0)
  })
  it("estado de la URL", () => {
    expect(
      playerSearchSchema.parse({ tab: "x", range: 15, kind: "pcw" })
    ).toEqual({
      kind: "pcw",
    })
    expect(toMatchesQuery({ kind: "mix", result: "won", page: 2 })).toEqual({
      page: 2,
      per: 25,
      kind: "mix",
      result: "won",
    })
  })
})
