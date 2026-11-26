import { describe, expect, it } from "vitest"

import { levelRange, playerChips, toFilterQuery } from "./filters"
import {
  playerRankingSearchSchema,
  savedRanking,
  toPlayerRankingQuery,
  toStandingsQuery,
} from "./search"

describe("filtros avanzados del ranking", () => {
  it("un valor inválido vuelve al de por defecto sin romper el resto", () => {
    expect(
      playerRankingSearchSchema.parse({
        q: "ab",
        kd: 9,
        lvMin: 0,
        act: 8,
        hs: 40,
      })
    ).toEqual({ q: "ab", hs: 40 })
  })

  it("los niveles usan los mismos pisos que la API (LEVEL_FLOORS de lib/db.ts)", () => {
    expect(levelRange(1, 10)).toEqual({})
    expect(levelRange(7, 9)).toEqual({ min: 1351, max: 2000 })
    expect(levelRange(10, 10)).toEqual({ min: 2001 })
    expect(levelRange(1, 1)).toEqual({ max: 500 })
  })

  it("con nivel y ELO, el rango más angosto", () => {
    expect(
      toFilterQuery({ lvMin: 7, lvMax: 9, eloMin: 1000, eloMax: 1500 })
    ).toEqual({ elo_min: 1351, elo_max: 1500 })
  })

  it("solo se mandan con VIP, en la temporada y en el Histórico", () => {
    const s = playerRankingSearchSchema.parse({
      q: " fako ",
      level: "10",
      kd: 1.2,
      vip: true,
      fav: "de_cache",
      team: "with",
    })
    const free = { page: 1, per: 25, q: "fako", level: "10" }
    const full = {
      ...free,
      kd_min: 1.2,
      vip: "true",
      map: "cache",
      has_team: "true",
    }
    for (const to of [toPlayerRankingQuery, toStandingsQuery]) {
      expect(to(s)).toEqual(free)
      expect(to(s, true)).toEqual(full)
    }
  })

  it("una píldora por filtro, y sacar un rango saca sus dos puntas", () => {
    const chips = playerChips({ lvMin: 4, eloMin: 800, kd: 1, ct: "Chile" })
    expect(chips.map((c) => c.label)).toEqual([
      "Nivel 4 a 10",
      "ELO desde 800",
      "K/D desde 1.00",
      "Chile",
    ])
    expect(chips[0]!.clear).toEqual(["lvMin", "lvMax"])
  })

  it("la búsqueda guardada no lleva la temporada y reemplaza los filtros", () => {
    const s = { season: "all", kd: 1, level: "10" as const, page: 2 }
    expect(savedRanking.save(s)).toEqual({ kd: 1, level: "10" })
    const patch = savedRanking.apply({ hs: 40, season: "s1" })
    expect({ ...s, ...patch }).toMatchObject({ season: "all", hs: 40 })
    expect({ ...s, ...patch }).toMatchObject({
      kd: undefined,
      level: undefined,
      page: undefined,
    })
  })
})
