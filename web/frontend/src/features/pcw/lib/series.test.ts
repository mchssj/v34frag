import { describe, expect, it } from "vitest"

import {
  abandonSide,
  seriesScore,
  seriesWinner,
  vetoOrder,
  vetoState,
  waitMinutes,
} from "./series"

const POOL = [
  "de_dust2",
  "de_inferno",
  "de_nuke",
  "de_train",
  "de_mirage",
  "de_cbble",
  "de_aztec",
]

describe("vetoOrder", () => {
  it("BO1: solo bans alternados hasta que queda uno", () => {
    const o = vetoOrder(1, 7)
    expect(o).toHaveLength(6)
    expect(o.every((s) => s.kind === "ban")).toBe(true)
    expect(o.map((s) => s.by)).toEqual([
      "us",
      "them",
      "us",
      "them",
      "us",
      "them",
    ])
  })

  it("BO3: dos bans, dos picks y bans hasta el decisivo", () => {
    expect(vetoOrder(3, 7).map((s) => s.kind)).toEqual([
      "ban",
      "ban",
      "pick",
      "pick",
      "ban",
      "ban",
    ])
  })

  it("BO5 con 5 mapas: sin bans, cuatro picks y el decisivo", () => {
    expect(vetoOrder(5, 5).map((s) => s.kind)).toEqual([
      "pick",
      "pick",
      "pick",
      "pick",
    ])
  })

  it("no deja un pool más chico que el formato", () => {
    expect(() => vetoOrder(5, 3)).toThrow()
  })
})

describe("vetoState", () => {
  it("al terminar, los picks en orden y el decisivo al final", () => {
    const s = vetoState(POOL, 3, [
      { map: "de_aztec", kind: "ban", by: "us" },
      { map: "de_cbble", kind: "ban", by: "them" },
      { map: "de_nuke", kind: "pick", by: "us" },
      { map: "de_train", kind: "pick", by: "them" },
      { map: "de_mirage", kind: "ban", by: "us" },
      { map: "de_dust2", kind: "ban", by: "them" },
    ])
    expect(s.done).toBe(true)
    expect(s.maps).toEqual(["de_nuke", "de_train", "de_inferno"])
  })

  it("a mitad del veto dice a quién le toca", () => {
    const s = vetoState(POOL, 3, [{ map: "de_aztec", kind: "ban", by: "us" }])
    expect(s.next).toEqual({ kind: "ban", by: "them" })
    expect(s.remaining).toHaveLength(6)
  })
})

describe("serie", () => {
  it("cuenta mapas y decide la BO3 con dos", () => {
    expect(
      seriesScore([
        [16, 10],
        [8, 16],
      ])
    ).toEqual([1, 1])
    expect(
      seriesWinner(3, [
        [16, 10],
        [8, 16],
      ])
    ).toBeNull()
    expect(
      seriesWinner(3, [
        [16, 10],
        [8, 16],
        [16, 14],
      ])
    ).toBe("us")
    expect(seriesWinner(1, [[12, 16]])).toBe("them")
  })

  it("espera de 15 minutos el primer mapa y 5 los siguientes", () => {
    expect(waitMinutes(1)).toBe(15)
    expect(waitMinutes(2)).toBe(5)
  })

  it("abandona el que no llegó a 5 adentro", () => {
    expect(abandonSide([5, 5])).toBeNull()
    expect(abandonSide([5, 3])).toBe("them")
    expect(abandonSide([4, 2])).toBe("both")
  })
})
