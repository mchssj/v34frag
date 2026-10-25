import { describe, expect, it } from "vitest"

import { pageList } from "@/components/brand/ListPagination"
import { mixesSearchSchema, toMixesQuery } from "./search"

describe("mixesSearchSchema", () => {
  it("acepta el estado del handoff", () => {
    expect(
      mixesSearchSchema.parse({
        q: "zeta",
        map: "de_dust2",
        mine: true,
        hideCancel: true,
        page: 3,
        per: 25,
      })
    ).toEqual({
      q: "zeta",
      map: "de_dust2",
      mine: true,
      hideCancel: true,
      page: 3,
      per: 25,
    })
  })

  it("un valor inválido vuelve al de por defecto sin romper el resto", () => {
    expect(
      mixesSearchSchema.parse({ page: 0, per: 50, mine: "sí", q: "nuke" })
    ).toEqual({ q: "nuke" })
  })
})

describe("toMixesQuery", () => {
  it("por defecto, página 1 de 15", () => {
    expect(toMixesQuery({})).toEqual({ page: 1, per: 15 })
  })

  it("pasa los filtros con los nombres de la API", () => {
    expect(
      toMixesQuery({
        q: "  zeta ",
        map: "de_nuke",
        mine: true,
        hideCancel: true,
        page: 2,
        per: 10,
      })
    ).toEqual({
      page: 2,
      per: 10,
      q: "zeta",
      map: "de_nuke",
      mine: "true",
      hide_cancelled: "true",
    })
  })

  it("una búsqueda de solo espacios no se manda", () => {
    expect(toMixesQuery({ q: "   " })).toEqual({ page: 1, per: 15 })
  })
})

describe("pageList", () => {
  it("todas las páginas si son pocas", () => {
    expect(pageList(1, 1)).toEqual([1])
    expect(pageList(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it("la primera, la última y las vecinas si son muchas", () => {
    expect(pageList(1, 20)).toEqual([1, 2, "…", 20])
    expect(pageList(10, 20)).toEqual([1, "…", 9, 10, 11, "…", 20])
    expect(pageList(20, 20)).toEqual([1, "…", 19, 20])
  })
})
