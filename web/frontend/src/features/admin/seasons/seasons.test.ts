import { describe, expect, it } from "vitest"

import type { Season } from "./queries"
import {
  addTier,
  argDay,
  endsIso,
  formError,
  fromSeason,
  removeTier,
  resetElo,
  resetRule,
  resetTitle,
  seasonPatch,
  setTierEnd,
  tierName,
  tiersError,
} from "./seasons"

const TIERS = [
  { from: 1, to: 1, name: "Campeón", icon: "🏆" },
  { from: 2, to: 10, name: "Top 10", icon: "🎖️" },
  { from: 11, to: null, name: "Top {top}", icon: "🏅" },
]

const season: Season = {
  id: "s3",
  number: 3,
  name: "Octubre",
  status: "active",
  starts_at: "2026-10-07T09:00:00Z",
  ends_at: "2099-11-06T09:00:00Z",
  closed_at: null,
  top_n: 20,
  min_matches: 20,
  reset_pct: 10,
  reset_floor: 2001,
  reset_all: false,
  tiers: TIERS,
  champion: null,
  medals: 0,
}

describe("Temporadas", () => {
  it("el reinicio de los ejemplos del contrato", () => {
    expect(resetElo(2540, 10, 2001)).toBe(2055)
    expect(resetElo(2200, 10, 2001)).toBe(2021)
    expect(resetElo(2010, 10, 2001)).toBe(2002)
    expect(resetElo(1990, 10, 2001)).toBe(1990)
    expect(resetElo(2540, 0, 2001)).toBe(2001)
  })

  it("reiniciar también a los de debajo del piso: suben hacia el piso; con 0 %, todos al piso", () => {
    expect(resetElo(2540, 10, 2001, true)).toBe(2055)
    expect(resetElo(1001, 10, 2001, true)).toBe(1901)
    expect(resetElo(2001, 10, 2001, true)).toBe(2001)
    expect(resetElo(2540, 0, 1000, true)).toBe(1000)
    expect(resetElo(400, 0, 1000, true)).toBe(1000)
    expect(resetTitle(2001, true)).toBe("Reinicio de todos")
  })

  it("las reglas del reinicio en una frase, para confirmar el cierre", () => {
    expect(resetRule(0, 1000, true)).toBe(
      "Reinicio total: todos quedan en 1000 de ELO."
    )
    expect(resetRule(10, 2001, true)).toMatch(
      /^Reinicio de todos: conservan el 10 %/
    )
    expect(resetRule(10, 2001, false)).toMatch(/^Reinicio: los de más de 2001/)
    expect(resetRule(100, 2001, false)).toBe(
      "Sin reinicio: nadie cambia de ELO."
    )
  })

  it("el título del reinicio dice desde qué nivel, según el piso", () => {
    expect(resetTitle(2001)).toBe("Reinicio de los nivel 10")
    expect(resetTitle(2000)).toBe("Reinicio de los nivel 10")
    expect(resetTitle(1800)).toBe("Reinicio desde el nivel 9")
    expect(resetTitle(1750)).toBe("Reinicio desde el nivel 9")
    expect(resetTitle(0)).toBe("Reinicio desde el nivel 1")
    expect(resetTitle(-1)).toBe("Reinicio del ELO")
  })

  it("el cierre es a las 06:00 de Argentina del día elegido", () => {
    expect(endsIso("2026-11-06")).toBe("2026-11-06T09:00:00.000Z")
    expect(argDay("2026-11-06T09:00:00Z")).toBe("2026-11-06")
    expect(argDay("2026-11-07T02:00:00Z")).toBe("2026-11-06")
  })

  it("tramos desde el 1, sin huecos y dentro del top", () => {
    expect(tiersError(TIERS, 20)).toBeNull()
    expect(tiersError(TIERS, 10)).toMatch(/fuera del top/)
    const gap = TIERS.map((t, i) => (i === 1 ? { ...t, from: 3 } : t))
    expect(tiersError(gap, 20)).toMatch(/sin huecos/)
    expect(tierName(TIERS[2], 20)).toBe("Top 20")
  })

  it("editar tramos los mantiene encadenados", () => {
    expect(tiersError(setTierEnd(TIERS, 1, 5), 20)).toBeNull()
    expect(setTierEnd(TIERS, 1, 5)[2].from).toBe(6)
    const added = addTier(TIERS)
    expect(added).toHaveLength(4)
    expect(tiersError(added, 20)).toBeNull()
    const removed = removeTier(TIERS, 1)
    expect(removed.map((t) => [t.from, t.to])).toEqual([
      [1, 1],
      [2, null],
    ])
  })

  it("el PATCH lleva solo lo que cambió", () => {
    const f = fromSeason(season)
    expect(seasonPatch(season, f)).toEqual({})
    expect(
      seasonPatch(season, { ...f, reset_pct: 20, ends: "2099-11-10" })
    ).toEqual({ reset_pct: 20, ends_at: "2099-11-10T09:00:00.000Z" })
    expect(seasonPatch(season, { ...f, reset_all: true })).toEqual({
      reset_all: true,
    })
  })

  it("no deja guardar valores fuera de rango ni una fecha pasada", () => {
    const f = fromSeason(season)
    expect(formError(f, "active")).toBeNull()
    expect(formError({ ...f, ends: "2020-01-01" }, "active")).toMatch(/futura/)
    expect(formError({ ...f, reset_pct: 101 }, "active")).toMatch(/0 a 100/)
    expect(formError({ ...f, days: 0 }, "next")).toMatch(/1 a 365/)
  })
})
