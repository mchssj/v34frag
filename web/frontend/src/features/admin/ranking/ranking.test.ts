import { describe, expect, it } from "vitest"

import { rerank } from "./AdminRankingPage"

const team = (name: string, won: number, lost: number) => ({
  team: { id: name, name },
  won,
  lost,
  points: won * 30,
})

describe("Ranking de equipos", () => {
  it("recalcula los puntos con el valor nuevo y desempata por victorias y derrotas", () => {
    const r = rerank([team("A", 3, 1), team("B", 4, 4), team("C", 4, 1)], 10)
    expect(r.map((t) => [t.team.name, t.newPoints])).toEqual([
      ["C", 40],
      ["B", 40],
      ["A", 30],
    ])
  })
})
