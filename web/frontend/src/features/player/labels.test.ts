import { describe, expect, it } from "vitest"

import {
  adjustmentLabel,
  bestSeasonId,
  mapCards,
  stintLength,
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
import type { MapEntry } from "@/features/maps/queries"
import type {
  EloAdjustment,
  MapStat,
  PlayerMatch,
  PlayerSeason,
} from "./queries"
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

describe("pestañas del perfil", () => {
  const entry = (name: string, o: Partial<MapEntry> = {}): MapEntry => ({
    name,
    versions: [name],
    active: true,
    position: 1,
    mixes: true,
    veto_default: true,
    image_url: null,
    ...o,
  })
  const stat = (map: string, maps: number): MapStat => ({
    map,
    maps,
    rating: 1,
    kd: 1,
    adr: 80,
    wins: 1,
    losses: 0,
  })

  it("Mapas: los jugados primero, después el resto del catálogo activo", () => {
    const catalog = [
      entry("de_dust2", { position: 1 }),
      entry("de_inferno", {
        position: 2,
        versions: ["de_inferno", "de_inferno_classic"],
      }),
      entry("de_nuke", { position: 3, image_url: "https://img/nuke.webp" }),
      entry("de_aztec", { position: 4, active: false }),
      entry("de_train", { position: 5, active: false }),
    ]
    const cards = mapCards(catalog, [
      stat("nuke", 5),
      stat("inferno_classic", 2),
      stat("aztec", 1),
      stat("mapa_raro", 1),
    ])
    expect(cards.map((c) => [c.name, c.stat?.maps ?? 0, c.retired])).toEqual([
      ["nuke", 5, false],
      ["inferno_classic", 2, false],
      // Retirado: solo porque lo jugó.
      ["aztec", 1, true],
      // No está en el catálogo: sin foto.
      ["mapa_raro", 1, false],
      // Sin partidas: el del catálogo, sin de_ (como los guarda la base).
      ["dust2", 0, false],
    ])
    expect(cards[0].image).toBe("https://img/nuke.webp")
    // Sin partidas: el catálogo activo completo, en cero.
    expect(mapCards(catalog, []).map((c) => c.name)).toEqual([
      "dust2",
      "inferno",
      "nuke",
    ])
  })

  it("Equipos: cuánto estuvo, hasta hoy si sigue", () => {
    const now = new Date("2026-10-30T12:00:00Z")
    expect(stintLength("2026-07-30T12:00:00Z", null, now)).toBe("3 meses")
    expect(
      stintLength("2026-02-01T00:00:00Z", "2026-06-01T00:00:00Z", now)
    ).toBe("4 meses")
    expect(stintLength(null, null, now)).toBeNull()
  })

  it("Temporadas: la mejor es el mejor puesto clasificado, si hay más de una", () => {
    const season = (
      id: string,
      rank: number | null,
      eligible = true
    ): PlayerSeason => ({
      rank,
      eligible,
      elo: 1000,
      level: 4,
      peak_elo: 1000,
      matches: 10,
      wins: 5,
      losses: 5,
      elo_after: 1000,
      medal: null,
      season: { id, number: 1, name: id },
    })
    expect(bestSeasonId([season("a", 12), season("b", 3)])).toBe("b")
    // Sin clasificar no cuenta, aunque tenga mejor puesto.
    expect(bestSeasonId([season("a", 12), season("b", 1, false)])).toBe("a")
    expect(bestSeasonId([season("a", 3)])).toBeNull()
    expect(bestSeasonId([season("a", null), season("b", null)])).toBeNull()
  })
})
