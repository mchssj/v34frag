import { describe, expect, it } from "vitest"

import {
  blindAt,
  bombAt,
  burstEnd,
  hitsAt,
  smokeOpacity,
  positionsAt,
  parseTrack,
} from "./track"

// Dos rondas; la 2 se juega dos veces (!rr) y vale la última. La 3 no termina.
const TRK = [
  "V 1 de_dust2 66 33",
  "R 1 0",
  "J 1 2 STEAM_0:1:1 Uno Dos",
  "J 2 3 STEAM_0:1:2 Tres",
  "Z 132",
  "F 132 1,0,0,10,90,100;2,100,0,10,180,100,b",
  "F 165 1,66,0,10,90,100;2,100,0,10,180,100,b",
  "B 200 plant 50 60",
  "K 231 1 2 ak47 1 66 0 100 0",
  "E 300 2 0",
  "R 2 330",
  "F 340 1,0,0,0,0,100",
  "R 2 600",
  "F 610 1,5,5,0,0,100",
  "K 620 0 1 world 0 - - 5 5",
  "E 660 3 7",
  "R 3 700",
  "F 710 1,0,0,0,0,100",
].join("\n")

describe("parseTrack", () => {
  const t = parseTrack(TRK)

  it("lee el mapa y deja solo las rondas terminadas, la última de cada número", () => {
    expect(t.map).toBe("de_dust2")
    expect(t.rounds.map((r) => r.n)).toEqual([1, 2])
    expect(t.rounds[1].start).toBeCloseTo(600 / 66)
    expect(t.rounds[1].frames).toHaveLength(1)
  })

  it("arma jugadores, kills, bomba y fin de ronda", () => {
    const r = t.rounds[0]
    expect(r.players[1].name).toBe("Uno Dos")
    expect(r.freezeEnd).toBe(2)
    expect(r.frames[0].ps[1]).toMatchObject({ slot: 2, bomb: true })
    expect(r.kills[0]).toMatchObject({
      weapon: "ak47",
      hs: true,
      from: { x: 66, y: 0 },
      at: { x: 100, y: 0 },
    })
    expect(r.kills[0].killer?.name).toBe("Uno Dos")
    expect(r.bomb[0]).toMatchObject({ kind: "plant", x: 50, y: 60 })
    expect(r.winner).toBe(2)
    expect(t.rounds[1].kills[0]).toMatchObject({ killer: null, from: null })
  })

  it("interpola las posiciones entre cuadros", () => {
    const r = t.rounds[0]
    const mid = positionsAt(r, (132 + 165) / 2 / 66)
    expect(mid[0].x).toBeCloseTo(33)
    expect(positionsAt(r, 0)[0].x).toBe(0)
    expect(positionsAt(r, 99)[0].x).toBe(66)
  })

  it("granadas: el tiro por entidad, dónde explotó y a quién cegó la flash", () => {
    const g = parseTrack(
      [
        "V 1 de_dust2 100 50",
        "R 1 0",
        "J 1 2 STEAM_0:1:1 Uno",
        "J 2 3 STEAM_0:1:2 Dos",
        "J 3 2 STEAM_0:1:3 Tres",
        "N 100 flash,40,1,0,0;smoke,41,2,500,500",
        "N 110 flash,40,1,10,0",
        "N 120 flash,40,1,20,0;he,42,3,7,7",
        "L 125 2 2.5", // el juego manda el cegado antes que la flash
        "G 125 flash 1 25 0",
        "L 126 3 1.0",
        "N 900 flash,40,1,0,0",
        "G 300 smoke 2 600 600",
        "G 301 rara 2 0 0",
        "E 1000 2 9",
      ].join("\n")
    )
    const r = g.rounds[0]
    expect(r.flights.map((f) => [f.kind, f.points.length])).toEqual([
      ["flash", 3],
      ["smoke", 1],
      ["he", 1],
      ["flash", 1], // la misma entidad 8 s después: otra granada
    ])
    expect(r.flights[0].thrower?.name).toBe("Uno")
    expect(r.bursts.map((b) => b.kind)).toEqual(["flash", "smoke"])
    expect(r.bursts[0].blinded.map((x) => [x.player.name, x.secs])).toEqual([
      ["Dos", 2.5],
      ["Tres", 1],
    ])
    const b = blindAt(r, 2.3)
    expect(b.get(2)?.left).toBeCloseTo(1.45)
    expect(b.has(3)).toBe(false)
  })

  it("arma, plata, reloj, C4 con su timer, desactivación, golpes y humo con su duración real", () => {
    const g = parseTrack(
      [
        "V 1 de_dust2 100 50",
        "R 1 0",
        "J 1 2 STEAM_0:1:1 Uno",
        "J 2 3 STEAM_0:1:2 Dos",
        "Z 200 115",
        "$ 200 1,4750;2,800",
        "F 200 1,0,0,0,0,100,ak47,b;2,9,9,0,0,100,m4a1",
        "G 300 smoke 2 100 100",
        "S 350 101,99,15.0,20.0",
        "S 2000 102,98;900,900",
        "S 2050 900,900",
        "B 1000 plant 5 5 40",
        "D 1500 2 1",
        "A 1600 2",
        "D 1700 2 0",
        "H 1800 1 2 27 73 ak47 1",
        "B 2700 defuse 5 5",
        "E 2700 3 7",
      ].join("\n")
    )
    const r = g.rounds[0]
    expect(r.roundTime).toBe(115)
    expect(r.money).toEqual({ 1: 4750, 2: 800 })
    expect(r.frames[0].ps.map((p) => [p.weapon, p.bomb])).toEqual([
      ["ak47", true],
      ["m4a1", false],
    ])
    // El humo dura lo que dice el juego: lleno hasta los 15 s de salir y se va hasta los 20.
    expect(r.bursts[0].until).toBe(20)
    expect(r.bursts[0].fade).toEqual([15, 20])
    expect(burstEnd(r.bursts[0])).toBe(23)
    expect(smokeOpacity(r.bursts[0], 17)).toBe(1)
    expect(smokeOpacity(r.bursts[0], 20.5)).toBeCloseTo(0.5)
    expect(smokeOpacity(r.bursts[0], 23)).toBe(0)
    expect(bombAt(r, 12)).toMatchObject({
      timer: 40,
      left: 38,
      state: "ticking",
    })
    expect(bombAt(r, 28)?.state).toBe("defuse")
    expect(r.defuses.map((d) => [d.kit, d.until])).toEqual([
      [true, 16],
      [false, 27],
    ])
    expect(hitsAt(r, 18.2)).toHaveLength(1)
    expect(r.hits[0]).toMatchObject({
      dmg: 27,
      hp: 73,
      weapon: "ak47",
      hitgroup: 1,
    })
  })

  it("un .trk del primer formato (sin arma) sigue andando", () => {
    const g = parseTrack(
      [
        "V 1 de_dust2 100 50",
        "R 1 0",
        "J 1 2 X Uno",
        "F 10 1,0,0,0,0,100,b",
        "E 20 2 9",
      ].join("\n")
    )
    expect(g.rounds[0].frames[0].ps[0]).toMatchObject({
      weapon: "",
      bomb: true,
    })
    expect(g.rounds[0].roundTime).toBeNull()
  })
})
