import { describe, expect, it } from "vitest"

import { levelOf } from "@/features/matchmaking/room/roomData"
import { LEVEL_FLOORS } from "@/features/player/labels"

import { PLAYERS } from "./demo"
import { filterPlayers, levelRange } from "./filters"

// Los niveles del buscador tienen que coincidir con los del backend (web/backend/src/lib/db.ts).
const BACKEND_FLOORS = [0, 501, 751, 901, 1051, 1201, 1351, 1531, 1751, 2001]

describe("niveles del buscador", () => {
  it("usa los mismos pisos que el backend", () => {
    expect([...LEVEL_FLOORS]).toEqual(BACKEND_FLOORS)
  })

  it("levelRange da los mismos cortes que levelBounds del backend", () => {
    expect(levelRange(10, 10)).toEqual({ gte: 2001 })
    expect(levelRange(7, 9)).toEqual({ gte: 1351, lt: 2001 })
    expect(levelRange(1, 6)).toEqual({ lt: 1351 })
    expect(levelRange()).toEqual({})
  })

  it("filtrar por nivel devuelve solo jugadores de ese nivel", () => {
    for (let n = 1; n <= 10; n++) {
      const rows = filterPlayers(PLAYERS, { lvMin: n, lvMax: n }, true)
      expect(
        rows.every((p) => levelOf(p.elo, LEVEL_FLOORS) === n && p.level === n)
      ).toBe(true)
    }
    expect(PLAYERS.some((p) => p.level === 10)).toBe(true)
  })
})
