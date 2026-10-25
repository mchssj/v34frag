import { describe, expect, it } from "vitest"

import { activeMapNames, mapImage, type MapEntry } from "./queries"

const maps: MapEntry[] = [
  { name: "de_nuke", active: true, image_url: "https://img/nuke.webp" },
  { name: "de_dust2", active: true, image_url: null },
  { name: "de_aztec", active: false, image_url: "https://img/aztec.webp" },
]

describe("maestra de mapas", () => {
  it("los activos, ordenados, para el select", () => {
    expect(activeMapNames(maps)).toEqual(["de_dust2", "de_nuke"])
    expect(activeMapNames(undefined)).toEqual([])
  })

  it("la foto por nombre, sin distinguir mayúsculas; null si no está o no tiene", () => {
    expect(mapImage(maps, "DE_NUKE")).toBe("https://img/nuke.webp")
    expect(mapImage(maps, "de_dust2")).toBeNull()
    expect(mapImage(maps, "de_train")).toBeNull()
    expect(mapImage(maps, null)).toBeNull()
    expect(mapImage(undefined, "de_nuke")).toBeNull()
  })
})
