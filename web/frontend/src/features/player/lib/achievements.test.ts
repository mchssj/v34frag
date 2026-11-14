import { describe, expect, it } from "vitest"

import {
  buildAchievements,
  type EarnedMedal,
  type Progress,
} from "./achievements"

const look = (id: string, template: string, metal: string, title: string) => ({
  id,
  key: id,
  title,
  template,
  number: "10",
  label: "X",
  band: null,
  metal,
  accent: null,
})
const step = (
  id: string,
  order: number,
  target: number,
  value: number,
  earned: string | null,
  metal: string
): Progress => ({
  design: look(id, "victorias", metal, `${target} victorias`),
  series: "victorias",
  series_order: order,
  target,
  value,
  data_since: null,
  earned_at: earned,
})

describe("Logros", () => {
  const progress: Progress[] = [
    step("v10", 1, 10, 73, "2026-11-01T00:00:00Z", "bronce"),
    step("v50", 2, 50, 73, "2026-11-02T00:00:00Z", "plata"),
    step("v100", 3, 100, 73, null, "oro"),
    step("v250", 4, 250, 73, null, "platino"),
    {
      design: look("awp", "awp", "bronce", "100 kills con AWP"),
      series: "awp",
      series_order: 1,
      target: 100,
      value: 41,
      data_since: "2026-10-29",
      earned_at: null,
    },
  ]
  const earned: EarnedMedal[] = [
    {
      id: "m1",
      title: "Temporada 1 · #3",
      created_at: "2026-12-03T09:00:00Z",
      source: "season",
      season: { name: "Temporada 1" },
      design: look("p3", "podio", "bronce", "Podio · puesto 3"),
    },
    {
      id: "m2",
      title: "10 victorias",
      created_at: "2026-11-01T00:00:00Z",
      source: "auto",
      season: null,
      design: look("v10", "victorias", "bronce", "10 victorias"),
    },
    {
      id: "m3",
      title: "Torneo X 2018",
      created_at: "2026-10-01T00:00:00Z",
      source: "admin",
      season: null,
      design: look("ct", "campeon_torneo", "oro", "Campeón de torneo"),
    },
  ]

  it("de cada serie, las ganadas y solo la próxima bloqueada", () => {
    const a = buildAchievements(earned, progress)
    const tray = a.sections.find((s) => s.title === "Trayectoria")!
    expect(tray.items.map((i) => [i.title, i.locked])).toEqual([
      ["10 victorias", false],
      ["50 victorias", false],
      ["100 victorias", true],
    ])
    expect(tray.items[2]).toMatchObject({ sub: "73 / 100", pct: 73 })
  })

  it("cuenta, vitrina, la más cerca y las manuales con su título", () => {
    const a = buildAchievements(earned, progress)
    expect(a.got).toBe(4) // 10 y 50 victorias, el podio y el torneo
    expect(a.pending).toBe(3)
    expect(a.closest?.title).toBe("100 victorias")
    expect(a.showcase[0]?.title).toBe("Podio · puesto 3")
    expect(a.sections.map((s) => s.title)).toEqual([
      "Temporada",
      "Trayectoria",
      "Arsenal y bomba",
      "Comunidad",
    ])
    expect(
      a.sections.find((s) => s.title === "Comunidad")!.items[0]!.title
    ).toBe("Torneo X 2018")
    expect(
      a.sections.find((s) => s.title === "Arsenal y bomba")!.items[0]
    ).toMatchObject({ locked: true })
  })

  it("la de un torneo lleva el torneo (replanteo 114)", () => {
    const a = buildAchievements(
      [
        {
          id: "m1",
          title: "Campeón · Copa",
          created_at: "2026-11-13T00:00:00Z",
          source: "event",
          season: null,
          event: { id: "e1", name: "Copa" },
          design: look("c", "campeon_torneo", "oro", "Campeón de torneo"),
        },
      ],
      []
    )
    expect(a.sections.flatMap((s) => s.items)[0]).toMatchObject({
      title: "Campeón · Copa",
      event: { id: "e1", name: "Copa" },
    })
  })
})
