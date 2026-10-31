import { describe, expect, it } from "vitest"

import { matchesSearchSchema, toMatchesQuery } from "./search"

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
