import { describe, expect, it } from "vitest"

import { matchChips, matchesSearchSchema, toMatchesQuery } from "./search"

describe("matchesSearchSchema", () => {
  it("acepta el tipo, la búsqueda, el mapa, la página y el tamaño", () => {
    expect(
      matchesSearchSchema.parse({
        kind: "mix",
        q: "lukas",
        map: "de_cache",
        page: 2,
        per: 25,
      })
    ).toEqual({ kind: "mix", q: "lukas", map: "de_cache", page: 2, per: 25 })
  })

  it("un valor inválido vuelve al de por defecto sin romper el resto", () => {
    expect(
      matchesSearchSchema.parse({ kind: "bye", per: 7, page: 0, map: "cbble" })
    ).toEqual({ map: "cbble" })
  })
})

describe("filtros avanzados (VIP)", () => {
  const s = {
    player: "fako",
    with: "kova",
    vs: "rory",
    diff: 3,
    demo: true,
    sort: "close" as const,
    from: "2026-11-01",
  }
  it("con VIP se mandan; el orden, con su dirección", () => {
    expect(toMatchesQuery(s, true)).toMatchObject({
      player: "fako",
      with: "kova",
      against: "rory",
      max_diff: 3,
      demo: "true",
      sort: "round_diff",
      order: "asc",
      from: new Date("2026-11-01T00:00:00").toISOString(),
    })
  })
  it("sin VIP no se mandan", () => {
    expect(toMatchesQuery(s)).toEqual(toMatchesQuery({}))
  })
  it("con y contra, solo con el jugador", () => {
    const q = toMatchesQuery({ with: "kova", vs: "rory" }, true)
    expect(q).not.toHaveProperty("with")
    expect(q).not.toHaveProperty("against")
  })
  it("las favoritas son para todos", () => {
    expect(toMatchesQuery({ fav: true })).toMatchObject({ favorites: "true" })
  })
  it("una píldora por filtro; sacar el jugador saca con y contra", () => {
    const chips = matchChips(s)
    expect(chips.map((c) => c.label)).toEqual([
      "Jugó fako",
      "Con kova",
      "Contra rory",
      "Desde 2026-11-01",
      "Diferencia de hasta 3",
      "Con demo",
      "Las más parejas",
    ])
    expect(chips[0]!.clear).toEqual(["player", "with", "vs"])
  })
})

describe("toMatchesQuery", () => {
  it("por defecto: solo las jugadas, la más nueva primero, página 1 de 15", () => {
    expect(toMatchesQuery({})).toEqual({
      page: 1,
      per: 15,
      status: "finished",
      sort: "played_at",
      order: "desc",
    })
  })

  it("pasa el tipo, la búsqueda y el mapa sin el prefijo de_", () => {
    expect(
      toMatchesQuery({ kind: "official", q: " copa ", map: "de_cache" })
    ).toMatchObject({ kind: "official", q: "copa", map: "cache" })
  })

  it("una búsqueda de solo espacios no se manda", () => {
    expect(toMatchesQuery({ q: "   " })).not.toHaveProperty("q")
  })
})
