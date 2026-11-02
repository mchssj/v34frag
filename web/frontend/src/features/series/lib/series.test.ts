import { describe, expect, it } from "vitest"

import {
  carouselClips,
  clipKind,
  clipsPending,
  lineups,
  seriesMaps,
  vetoLines,
  type SeriesDetail,
} from "./series"

const T1 = "11111111-1111-4111-8111-111111111111"
const T2 = "22222222-2222-4222-8222-222222222222"

const game = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  map: null,
  score1: 16,
  score2: 10,
  played_at: "2026-11-01T20:00:00Z",
  demo_url: null,
  demo_size: null,
  demo_status: "uploaded",
  players: [],
  ...over,
})

function detail(over: Partial<Record<keyof SeriesDetail, unknown>> = {}) {
  return {
    id: "m1",
    status: "finished",
    best_of: 3,
    side1: {
      name: "Tormenta",
      team: { id: T1, name: "Tormenta", tag: "TR" },
      score: 1,
    },
    side2: {
      name: "Kraken",
      team: { id: T2, name: "Kraken", tag: "KR" },
      score: 2,
    },
    winner_side: 2,
    maps_detail: [
      { map: "de_cbble", r1: 13, r2: 16, game_id: "g1" },
      { map: "de_dust2", r1: 16, r2: 4, game_id: null },
      { map: "de_inferno", r1: 17, r2: 19, game_id: "g3" },
    ],
    games: [
      game("g1", { players: [{ side: 1 }] }),
      game("g3", { players: [] }),
    ],
    veto: {
      pool: [],
      actions: [
        { seq: 1, team_id: T1, map: "de_nuke", action: "ban", version: null },
        { seq: 2, team_id: T2, map: "de_train", action: "ban", version: null },
        { seq: 3, team_id: T1, map: "de_cbble", action: "pick", version: null },
        { seq: 4, team_id: T2, map: "de_dust2", action: "pick", version: null },
      ],
      sequence: [],
      next: null,
      maps_to_play: [
        { map: "de_cbble", version: "", decider: false },
        { map: "de_dust2", version: "", decider: false },
        { map: "de_inferno", version: "", decider: true },
      ],
    },
    live: null,
    series_players: [],
    roster1: [],
    roster2: [],
    ...over,
  } as unknown as SeriesDetail
}

describe("seriesMaps", () => {
  it("arma cada mapa con quién lo eligió, el ganador y si se cargó a mano", () => {
    const maps = seriesMaps(detail())
    expect(
      maps.map((m) => [m.map, m.pick, m.decider, m.winner, m.manual])
    ).toEqual([
      ["de_cbble", 1, false, 2, false],
      ["de_dust2", 2, false, 1, true],
      ["de_inferno", null, true, 2, false],
    ])
    expect(maps[0].game?.id).toBe("g1")
  })

  it("el decisivo que no se jugó queda como sobrante; el que se juega ahora, en vivo", () => {
    const done = detail({
      maps_detail: [
        { map: "de_cbble", r1: 10, r2: 16, game_id: null },
        { map: "de_dust2", r1: 4, r2: 16, game_id: null },
      ],
    })
    expect(seriesMaps(done)[2]).toMatchObject({
      map: "de_inferno",
      leftOver: true,
    })
    const live = detail({
      status: "live",
      maps_detail: [{ map: "de_cbble", r1: 13, r2: 16, game_id: null }],
      live: { map: "de_dust2" },
    })
    expect(seriesMaps(live).map((m) => [m.map, m.live, m.leftOver])).toEqual([
      ["de_cbble", false, false],
      ["de_dust2", true, false],
      ["de_inferno", false, false],
    ])
  })
})

describe("vetoLines", () => {
  it("cuenta el veto en orden y cierra con el decisivo", () => {
    expect(vetoLines(detail())).toEqual([
      "Tormenta sacó de_nuke",
      "Kraken sacó de_train",
      "Tormenta eligió de_cbble",
      "Kraken eligió de_dust2",
      "de_inferno quedó como decisivo",
    ])
    expect(vetoLines(detail({ veto: null }))).toEqual([])
  })
})

describe("lineups", () => {
  it("con mapas jugados usa el rating de la serie; si no, el de las últimas semanas", () => {
    const played = detail({
      series_players: [
        { side: 1, alias: "uno", game_nick: "u", rating: 1.2 },
        { side: 2, alias: null, game_nick: "dos", rating: 0.8 },
      ],
    })
    expect(lineups(played)).toEqual({
      sides: [[{ name: "uno", rating: 1.2 }], [{ name: "dos", rating: 0.8 }]],
      source: "series",
    })
    const before = detail({
      roster1: [{ alias: "a", rating: 1.05 }],
      roster2: [{ alias: "b", rating: null }],
    })
    expect(lineups(before).source).toBe("recent")
    expect(
      lineups(detail({ roster1: [{ alias: "a", rating: null }] })).source
    ).toBeNull()
  })
})

describe("clips", () => {
  const clip = (id: string, position: number, status: string, type = "3k") =>
    ({ id, position, type, video: { status } }) as never
  it("ordena por mapa y por puesto, y deja afuera los que nunca van a tener video", () => {
    const maps = seriesMaps(detail())
    const byGame = new Map([
      ["g3", [clip("c3", 1, "done")]],
      [
        "g1",
        [
          clip("c2", 2, "pending"),
          clip("c1", 1, "done"),
          clip("cx", 3, "failed"),
        ],
      ],
    ])
    expect(carouselClips(maps, byGame).map((c) => [c.id, c.mapN])).toEqual([
      ["c1", 1],
      ["c2", 1],
      ["c3", 3],
    ])
  })

  it("procesando: un mapa recién jugado con la demo subiéndose", () => {
    const now = Date.parse("2026-11-01T21:00:00Z")
    const pending = detail({ games: [game("g1", { demo_status: "pending" })] })
    expect(clipsPending(seriesMaps(pending), now)).toBe(true)
    expect(clipsPending(seriesMaps(pending), now + 7 * 3600_000)).toBe(false)
    expect(clipsPending(seriesMaps(detail()), now)).toBe(false)
  })

  it("nombra cada tipo", () => {
    expect(["ace", "4k", "3k", "clutch_3"].map(clipKind)).toEqual([
      "ACE",
      "4K",
      "3K",
      "1v3",
    ])
  })
})
