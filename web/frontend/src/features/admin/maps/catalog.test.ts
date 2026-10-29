import { describe, expect, it } from "vitest"

import type { MapEntry } from "@/features/maps/queries"
import {
  changedCount,
  fromCatalog,
  imageError,
  moveMap,
  newMapError,
  saveError,
  setActive,
  toBody,
  versionError,
} from "./catalog"

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

const saved = fromCatalog([
  entry("de_nuke", { position: 2 }),
  entry("de_dust2", { position: 1 }),
  entry("de_inferno", {
    position: 3,
    versions: ["de_inferno", "de_inferno_classic"],
  }),
])

describe("borrador del catálogo de mapas", () => {
  it("sale en el orden del catálogo", () => {
    expect(saved.map((m) => m.name)).toEqual([
      "de_dust2",
      "de_nuke",
      "de_inferno",
    ])
  })

  it("cuenta los mapas que cambiaron o se movieron", () => {
    expect(changedCount(saved, saved)).toBe(0)
    expect(changedCount(moveMap(saved, 0, 1), saved)).toBe(2)
    const off = saved.map((m, i) => (i === 2 ? { ...m, mixes: false } : m))
    expect(changedCount(off, saved)).toBe(1)
  })

  it("retirar lo saca de Mixes y del pool por defecto, también en lo que se manda", () => {
    const r = setActive(saved[0], false)
    expect(r).toMatchObject({
      active: false,
      mixes: false,
      veto_default: false,
    })
    expect(setActive(r, true)).toMatchObject({ active: true, mixes: false })
    expect(toBody([{ ...r, mixes: true }]).maps[0].mixes).toBe(false)
  })

  it("el pool por defecto necesita al menos 2", () => {
    expect(saveError(saved)).toBeNull()
    const one = saved.map((m, i) => (i ? setActive(m, false) : m))
    expect(saveError(one)).toMatch(/al menos 2/)
  })

  it("nombres y versiones válidos y sin repetir entre mapas", () => {
    expect(newMapError(saved, "de_russka")).toBeNull()
    expect(newMapError(saved, "De Russka")).toMatch(/minúsculas/)
    expect(newMapError(saved, "de_inferno_classic")).toMatch(/ya está/)
    expect(versionError(saved, saved[0], "de_dust2_v2")).toBeNull()
    expect(versionError(saved, saved[0], "de_nuke")).toMatch(/ya es de/)
    const five = { ...saved[0], versions: ["a1", "a2", "a3", "a4", "a5"] }
    expect(versionError(saved, five, "a6")).toMatch(/Hasta 5/)
  })

  it("la foto: JPG, PNG o WebP de hasta 2 MB", () => {
    const file = (type: string, size: number) =>
      new File([new Uint8Array(size)], "f", { type })
    expect(imageError(file("image/webp", 1000))).toBeNull()
    expect(imageError(file("image/gif", 1000))).toMatch(/JPG/)
    expect(imageError(file("image/png", 3 * 1024 * 1024))).toMatch(/2 MB/)
  })
})
