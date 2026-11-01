import { describe, expect, it } from "vitest"

import {
  koRound1,
  mapsProblem,
  moveItem,
  nextStep,
  presetOf,
  seedBlocks,
  seedOrder,
  seriesScore,
  snakeGroups,
  swissMatches,
  swissRound1,
  swissTeams,
} from "./model"

describe("nextStep", () => {
  const base = {
    teams: 0,
    max_teams: null,
    progress: null,
    current_stage: null,
    champion: null,
  }
  it("dice qué falta según el estado", () => {
    expect(nextStep({ ...base, status: "registration" })).toEqual({
      text: "Sin inscritos todavía",
      tone: "warn",
    })
    expect(nextStep({ ...base, status: "registration", teams: 1 }).text).toBe(
      "Falta al menos otro equipo"
    )
    expect(
      nextStep({ ...base, status: "registration", teams: 12, max_teams: 24 })
    ).toEqual({
      text: "12/24 inscritos · por generar",
      tone: "primary",
    })
    expect(
      nextStep({
        ...base,
        status: "in_progress",
        progress: { played: 5, total: 8 },
        current_stage: "Semifinal",
      })
    ).toEqual({ text: "Semifinal · 3 partidas pendientes", tone: "warn" })
    expect(
      nextStep({
        ...base,
        status: "in_progress",
        progress: { played: 8, total: 8 },
      }).text
    ).toBe("esperando la ronda siguiente")
    expect(
      nextStep({ ...base, status: "finished", champion: { name: "Jaguares" } })
        .text
    ).toBe("Campeón: Jaguares")
    expect(nextStep({ ...base, status: "cancelled" }).tone).toBe("muted")
  })
})

describe("suizo", () => {
  it("partidas y rondas como en el motor", () => {
    expect(swissMatches(16, 3)).toEqual({ total: 33, rounds: 5 })
    expect(swissMatches(8, 2)).toEqual({ total: 10, rounds: 3 })
  })
  it("equipos y presets", () => {
    expect(swissTeams(2, 16)).toBe(24)
    expect(swissTeams(3, 16)).toBe(32)
    expect(swissTeams(1, 8)).toBe(8)
    expect(presetOf({ stages: 2, size: 16, wins: 3 })).toBe("classic")
    expect(presetOf({ stages: 2, size: 8, wins: 2 })).toBe("custom")
  })
})

describe("siembra", () => {
  it("bloques del suizo: los mejores, a la etapa más avanzada", () => {
    expect(seedBlocks("swiss", { stages: 2, size: 16 }, 24)).toEqual([
      { label: "Entran directo a la etapa 2", from: 1, to: 8 },
      { label: "Juegan la etapa 1", from: 9, to: 24 },
    ])
    expect(
      seedBlocks("swiss", { stages: 3, size: 16 }, 32).map((b) => [
        b.from,
        b.to,
      ])
    ).toEqual([
      [1, 8],
      [9, 16],
      [17, 32],
    ])
    expect(seedBlocks("single", {}, 8)).toEqual([{ label: "", from: 1, to: 8 }])
    expect(seedBlocks("swiss", { stages: 1, size: 16 }, 16)).toHaveLength(1)
  })
  it("cruces: llave clásica, suizo y serpentina", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
    const six = ["a", "b", "c", "d", "e", "f"]
    // Con 6 en una llave de 8, los dos mejores pasan con bye.
    expect(koRound1(six).map((p) => [p.a, p.b])).toEqual([
      ["a", null],
      ["d", "e"],
      ["b", null],
      ["c", "f"],
    ])
    expect(
      swissRound1(["a", "b", "c", "d"], 9).map((p) => [p.a, p.b, p.sa, p.sb])
    ).toEqual([
      ["a", "c", 9, 11],
      ["b", "d", 10, 12],
    ])
    expect(snakeGroups([1, 2, 3, 4, 5, 6, 7, 8], 4)).toEqual([
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ])
  })
  it("mover un equipo en la lista", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"])
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"])
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"])
  })
})

describe("mapas de una serie", () => {
  it("marcador y serie definida", () => {
    expect(
      seriesScore(
        [
          { r1: 16, r2: 10 },
          { r1: 12, r2: 16 },
        ],
        3
      )
    ).toEqual({ w1: 1, w2: 1, decided: false })
    expect(
      seriesScore(
        [
          { r1: 16, r2: 10 },
          { r1: 16, r2: 3 },
        ],
        3
      )
    ).toEqual({ w1: 2, w2: 0, decided: true })
    expect(seriesScore([{ r1: 16, r2: 10 }], 3, 1).decided).toBe(true)
  })
  it("problemas al guardar", () => {
    expect(
      mapsProblem([{ kind: "manual", map: "x", r1: 16, r2: 16 }], 3)
    ).toMatch(/empatado/)
    expect(
      mapsProblem([{ kind: "manual", map: "x", r1: null, r2: 3 }], 3)
    ).toMatch(/Faltan/)
    const mix = {
      kind: "mix" as const,
      game_id: "g",
      side1: 1 as const,
      map: "x",
      r1: 16,
      r2: 3,
    }
    expect(mapsProblem([mix, mix], 3)).toMatch(/mismo mix/)
    expect(mapsProblem([mix, mix, mix, mix], 3)).toMatch(/Hasta 3/)
    expect(mapsProblem([mix], 1)).toBeNull()
  })
})
