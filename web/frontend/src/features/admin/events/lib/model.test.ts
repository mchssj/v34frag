import { describe, expect, it } from "vitest"

import {
  fillSlots,
  koRound1,
  placeTeam,
  seedLayout,
  type LayoutSlot,
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
  swissCupo,
  swissTeams,
  teamsIssue,
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

describe("siembra sobre la llave", () => {
  const seedsOf = (slots: LayoutSlot[]) =>
    slots.map((s) => (s.kind === "seed" ? s.seed : s.kind))

  it("eliminación directa: todas las rondas y byes", () => {
    const [llave] = seedLayout("single", {}, 6)
    expect(llave.cols.map((c) => c.title)).toEqual([
      "Cuartos",
      "Semifinal",
      "Final",
    ])
    expect(llave.cols[0].boxes.map((b) => seedsOf(b.slots))).toEqual([
      [1, "bye"],
      [4, 5],
      [2, "bye"],
      [3, 6],
    ])
    expect(llave.cols[2].boxes[0].slots).toEqual([
      { kind: "ph", text: "Ganador 2.1" },
      { kind: "ph", text: "Ganador 2.2" },
    ])
    expect(seedLayout("single", {}, 1)).toEqual([])
  })
  it("doble: final superior y gran final", () => {
    const [sup] = seedLayout("double", {}, 4)
    expect(sup.cols.map((c) => c.title)).toEqual([
      "Semifinal",
      "Final superior",
      "Gran final",
    ])
  })
  it("grupos en serpentina", () => {
    const [g] = seedLayout("groups", { groups: 2, advance: 2 }, 8)
    expect(g.cols.map((c) => seedsOf(c.boxes[0].slots))).toEqual([
      [1, 4, 5, 8],
      [2, 3, 6, 7],
    ])
    expect(g.hint).toContain("Pasan 2 por grupo")
  })
  it("suizo: los que entran directo y la ronda 1 de la etapa 1", () => {
    const secs = seedLayout("swiss", { stages: 2, size: 16, wins: 3 }, 24)
    expect(secs.map((s) => s.title)).toEqual(["Entran directo", "Etapa 1"])
    expect(seedsOf(secs[0].cols[0].boxes[0].slots)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ])
    expect(seedsOf(secs[1].cols[0].boxes[0].slots)).toEqual([9, 17])
    expect(secs[1].cols[0].boxes).toHaveLength(8)
    const [solo] = seedLayout("swiss", { stages: 1, size: 8, wins: 2 }, 8)
    expect(solo.cols[0].boxes.map((b) => seedsOf(b.slots))).toEqual([
      [1, 5],
      [2, 6],
      [3, 7],
      [4, 8],
    ])
  })
  it("poner un equipo: intercambio, desde los sin ubicar y fuera de rango", () => {
    expect(placeTeam(["a", "b", "c"], "c", 0)).toEqual(["c", "b", "a"])
    expect(placeTeam(["a", null, "c"], "a", 1)).toEqual([null, "a", "c"])
    // Desde los sin ubicar: el que estaba vuelve a la columna (sale de la lista).
    expect(placeTeam(["a", "b", null], "d", 1)).toEqual(["a", "d", null])
    expect(placeTeam(["a", "b"], "a", 0)).toEqual(["a", "b"])
    expect(placeTeam(["a", "b"], "c", 5)).toEqual(["a", "b"])
  })
  it("completar huecos en orden", () => {
    expect(fillSlots([null, "b", null, null], ["x", "y"])).toEqual([
      "x",
      "b",
      "y",
      null,
    ])
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

describe("cupo y equipos por formato", () => {
  it("solo el suizo completa el cupo", () => {
    expect(swissCupo("swiss", { stages: 2, size: 16 })).toBe(24)
    expect(swissCupo("swiss", { stages: 3, size: 16 })).toBe(32)
    expect(swissCupo("swiss", { stages: 1, size: 8 })).toBe(8)
    expect(swissCupo("groups", { groups: 4 })).toBeNull()
    expect(swissCupo("single", {})).toBeNull()
  })

  it("avisa si los inscritos no entran en el formato", () => {
    expect(teamsIssue("swiss", { stages: 2, size: 16 }, 21)).toBe(
      "El suizo necesita 24 equipos y hay 21: faltan 3."
    )
    expect(teamsIssue("swiss", { stages: 2, size: 16 }, 26)).toBe(
      "El suizo necesita 24 equipos y hay 26: sobran 2."
    )
    expect(teamsIssue("swiss", { stages: 2, size: 16 }, 24)).toBeNull()
    expect(teamsIssue("groups", { groups: 4 }, 7)).toBe(
      "Con 4 grupos hacen falta al menos 8 equipos y hay 7: faltan 1."
    )
    expect(teamsIssue("groups_double", { groups: 2 }, 17)).toBe(
      "Con 2 grupos hacen falta entre 8 y 16 equipos y hay 17: sobran 1."
    )
    expect(teamsIssue("single", {}, 5)).toBeNull()
    expect(teamsIssue("double", {}, 1)).toBe(
      "Hacen falta al menos 2 equipos y hay 1: faltan 1."
    )
  })
})
