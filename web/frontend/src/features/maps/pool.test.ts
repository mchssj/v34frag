import { describe, expect, it } from "vitest"

import { defaultPool, poolChoices, poolError } from "./pool"
import type { MapEntry } from "./queries"

const map = (name: string, o: Partial<MapEntry> = {}): MapEntry => ({
  name,
  versions: [name],
  active: true,
  position: 1,
  mixes: true,
  veto_default: true,
  image_url: null,
  ...o,
})

const maps = [
  map("de_nuke", { position: 3 }),
  map("de_dust2", { position: 1 }),
  map("de_inferno", { position: 2 }),
  map("de_russka", { position: 4, veto_default: false }),
  map("de_piranesi", { position: 5, active: false, veto_default: false }),
]

describe("pool de mapas de un torneo o una PCW", () => {
  it("el pool por defecto: disponibles y marcados, en el orden del catálogo", () => {
    expect(defaultPool(maps)).toEqual(["de_dust2", "de_inferno", "de_nuke"])
  })

  it("se eligen los disponibles; un retirado solo si ya estaba en el pool", () => {
    expect(poolChoices(maps, []).map((m) => m.name)).not.toContain(
      "de_piranesi"
    )
    expect(poolChoices(maps, ["de_piranesi"]).map((m) => m.name)).toContain(
      "de_piranesi"
    )
  })

  it("entre el BO y 20 mapas", () => {
    expect(poolError(null, maps, 3)).toBeNull()
    expect(poolError(null, maps, 5)).toMatch(/pool por defecto tiene 3/)
    expect(poolError(["de_dust2", "de_russka"], maps, 3)).toMatch(/Faltan/)
    expect(poolError(["de_dust2", "de_russka", "de_nuke"], maps, 3)).toBeNull()
    const many = Array.from({ length: 21 }, (_, i) => `m${i}`)
    expect(poolError(many, maps, 1)).toBe("Hasta 20 mapas.")
  })
})
