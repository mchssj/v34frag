import { describe, expect, it } from "vitest"

import { mapImage, mixMapNames, type MapEntry } from "./queries"

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

const maps: MapEntry[] = [
  map("de_nuke", { position: 3, image_url: "https://img/nuke.webp" }),
  map("de_inferno", {
    position: 2,
    versions: ["de_inferno", "de_inferno_classic"],
    image_url: "https://img/inferno.webp",
  }),
  map("de_dust2", { position: 1 }),
  map("de_russka", { position: 4, mixes: false, veto_default: false }),
  map("de_aztec", {
    position: 5,
    active: false,
    mixes: false,
    veto_default: false,
    image_url: "https://img/aztec.webp",
  }),
]

describe("catálogo de mapas", () => {
  it("el select de Mixes: disponibles y de Mixes, en el orden del catálogo", () => {
    expect(mixMapNames(maps)).toEqual(["de_dust2", "de_inferno", "de_nuke"])
    expect(mixMapNames(undefined)).toEqual([])
  })

  it("la foto por nombre o versión, sin distinguir mayúsculas; null si no está o no tiene", () => {
    expect(mapImage(maps, "DE_NUKE")).toBe("https://img/nuke.webp")
    expect(mapImage(maps, "de_inferno_classic")).toBe(
      "https://img/inferno.webp"
    )
    expect(mapImage(maps, "de_aztec")).toBe("https://img/aztec.webp")
    // Así lo guarda la base: sin el prefijo.
    expect(mapImage(maps, "nuke")).toBe("https://img/nuke.webp")
    expect(mapImage(maps, "inferno_classic")).toBe(
      "https://img/inferno.webp"
    )
    expect(mapImage(maps, "de_dust2")).toBeNull()
    expect(mapImage(maps, "de_train")).toBeNull()
    expect(mapImage(maps, null)).toBeNull()
    expect(mapImage(undefined, "de_nuke")).toBeNull()
  })
})
