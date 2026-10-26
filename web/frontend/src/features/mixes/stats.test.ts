import { describe, expect, it } from "vitest"

import type { RoomPlayer } from "./room"
import {
  bestValues,
  columnsFor,
  nextSort,
  sortPlayers,
  type StatColumn,
} from "./stats"

const player = (o: Partial<RoomPlayer>): RoomPlayer => ({
  key: o.nick ?? "x",
  nick: "x",
  alias: null,
  guest: false,
  mvp: false,
  me: false,
  k: 0,
  d: 0,
  a: 0,
  hs: null,
  hsKills: 0,
  adr: null,
  rounds: 0,
  k2: 0,
  k3: 0,
  k4: 0,
  k5: 0,
  fk: 0,
  fd: 0,
  plants: 0,
  defuses: 0,
  clutches: null,
  rating: null,
  delta: null,
  ...o,
})

const col = (cols: StatColumn[], key: string) =>
  cols.find((c) => c.key === key)!

describe("estadísticas de la sala", () => {
  it("fórmulas; un divisor 0 da null", () => {
    const g = columnsFor("general", "finished")
    const a = columnsFor("advanced", "finished")
    const e = columnsFor("entry", "finished")
    const c = columnsFor("clutch", "finished")
    const p = player({
      k: 27,
      d: 14,
      rounds: 22,
      k2: 6,
      k3: 2,
      k4: 1,
      fk: 6,
      fd: 2,
      clutches: [2, 1, 0, 0, 0],
    })
    expect(col(g, "pm").value(p)).toBe(13)
    expect(col(g, "kr").value(p)).toBeCloseTo(1.227, 3)
    expect(col(a, "mk").value(p)).toBe(9)
    expect(col(a, "mkp").value(p)).toBe(41)
    expect(col(e, "tries").value(p)).toBe(8)
    expect(col(e, "fdiff").value(p)).toBe(4)
    expect(col(e, "tryp").value(p)).toBe(36)
    expect(col(e, "win").value(p)).toBe(75)
    expect(col(c, "ctotal").value(p)).toBe(3)

    const empty = player({})
    expect(col(g, "kr").value(empty)).toBeNull()
    expect(col(a, "mkp").value(empty)).toBeNull()
    expect(col(e, "win").value(empty)).toBeNull()
    expect(col(c, "c1").value(empty)).toBeNull()
  })

  it("en vivo no hay Δ ELO", () => {
    expect(columnsFor("general", "live").map((c) => c.key)).not.toContain(
      "delta"
    )
    expect(columnsFor("general", "finished").at(-1)?.key).toBe("delta")
  })

  it("mejor valor: el mayor, el menor donde menos es mejor, empates y todos en 0", () => {
    const cols = columnsFor("general", "finished")
    const players = [
      player({ nick: "a", k: 20, d: 10, k5: 0, delta: 20 }),
      player({ nick: "b", k: 20, d: 15, k5: 0, delta: 25 }),
    ]
    const best = bestValues(cols, players)
    expect(best.k).toBe(20)
    expect(best.d).toBe(10)
    expect(best.k5).toBeNull()
    expect(best.delta).toBeNull()
  })

  it("orden: mayor a menor, invertido y de vuelta al de rating", () => {
    let s = nextSort(null, "k")
    expect(s).toEqual({ key: "k", dir: "desc" })
    s = nextSort(s, "k")
    expect(s).toEqual({ key: "k", dir: "asc" })
    expect(nextSort(s, "k")).toBeNull()
    expect(nextSort(s, "d")).toEqual({ key: "d", dir: "desc" })

    const cols = columnsFor("entry", "finished")
    const players = [
      player({ nick: "a", fk: 1, fd: 1 }),
      player({ nick: "b", fk: 3, fd: 0 }),
      player({ nick: "c" }),
    ]
    expect(
      sortPlayers(players, cols, { key: "win", dir: "desc" }).map((p) => p.nick)
    ).toEqual(["b", "a", "c"])
    expect(
      sortPlayers(players, cols, { key: "fk", dir: "asc" }).map((p) => p.nick)
    ).toEqual(["c", "a", "b"])
    expect(sortPlayers(players, cols, null)).toBe(players)
  })
})
