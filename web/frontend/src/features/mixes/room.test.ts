import { describe, expect, it } from "vitest"

import type { LiveMixDetail } from "./queries"
import { roomFromLive, roomFromMatch, type MatchInput } from "./room"

const line = (o: Partial<MatchInput["players"][number]> = {}) => ({
  player_id: "p-" + (o.alias ?? o.game_nick ?? "x"),
  alias: "x",
  game_nick: "x_game",
  steam_id: null,
  side: 1,
  kills: 20,
  deaths: 15,
  assists: 4,
  headshots: 10,
  damage: 2400,
  rounds: 26,
  rating: 1.1,
  elo_delta: 25,
  k2: null,
  k3: null,
  k4: null,
  k5: null,
  first_kills: null,
  first_deaths: null,
  plants: null,
  defuses: null,
  ...o,
})

const zeta = line({ alias: "Zeta", rating: 1.5, player_id: "me" })
const guest = line({
  alias: null,
  player_id: null,
  steam_id: "765",
  game_nick: "invitado",
  rating: 0.8,
})
const vasco = line({ alias: "Vasco", side: 2, rating: 1.2, elo_delta: -25 })

const match = (o: Partial<MatchInput> = {}): MatchInput => ({
  status: "finished",
  map: "de_tuscan",
  server: { name: "CM League #1" },
  played_at: "2026-10-24T23:00:00Z",
  starts_at: null,
  side1: { name: "Bando Zeta", score: 16 },
  side2: { name: "Bando Vasco", score: 12 },
  winner_side: 1,
  players: [guest, zeta, vasco],
  mvp: zeta,
  demo_status: "uploaded",
  demo_url: "https://demos/x.dem",
  demo_size: 40_000_000,
  cancel_reason: null,
  review: null,
  ...o,
})

describe("roomFromMatch", () => {
  it("terminado: reparte por bando, ordena por rating y marca ganador, MVP, invitado y al usuario", () => {
    const r = roomFromMatch(match(), "me")
    expect(r.status).toBe("finished")
    expect(r.side1.result).toBe("win")
    expect(r.side2.result).toBe("loss")
    expect(r.side1.players.map((p) => p.nick)).toEqual(["Zeta", "invitado"])
    const [z, g] = r.side1.players
    expect(z).toMatchObject({ mvp: true, me: true, guest: false, delta: 25 })
    expect(g).toMatchObject({ mvp: false, me: false, guest: true, alias: null })
    expect(z.hs).toBe(50)
    expect(z.adr).toBe(92)
    expect(r.side2.players[0].delta).toBe(-25)
  })

  it("cancelado: sin ganador ni Δ ELO, con su motivo y la revisión pendiente", () => {
    const r = roomFromMatch(
      match({
        status: "cancelled",
        winner_side: null,
        cancel_reason: "crash",
        review: "pending",
      }),
      null
    )
    expect(r.side1.result).toBe("cancelled")
    expect(r.side1.players.every((p) => p.delta === null && !p.mvp)).toBe(true)
    expect(r.reviewPending).toBe(true)
    expect(r.cancelReason).toBe("crash")
  })

  it("terminado sin ganador es empate", () => {
    const r = roomFromMatch(match({ winner_side: null }), null)
    expect(r.side1.result).toBe("draw")
    expect(r.side2.result).toBe("draw")
  })
})

describe("roomFromLive", () => {
  const live: LiveMixDetail = {
    uid: "lv-1",
    server: { id: "s1", name: "RBK" },
    map: "de_nuke",
    side1: { name: "Bando Zeta", score: 9 },
    side2: { name: "Bando Vasco", score: 7 },
    rounds_played: 16,
    max_rounds: 24,
    started_at: "2026-10-24T22:40:00Z",
    updated_at: "2026-10-24T23:00:00Z",
    stale: true,
    parent_match_id: null,
    tv: { host: "1.2.3.4", port: 27020 },
    seq: 16,
    rounds: [],
    players: [
      { ...zeta, game_nick: "Zeta", elo: 1500, level: 6 },
      { ...vasco, game_nick: "Vasco", rating: 1.9, elo: 1400, level: 5 },
    ],
  }

  it("en juego, ronda actual, sin Δ ELO y MVP parcial por el mejor rating", () => {
    const r = roomFromLive(live, "me")
    expect(r.status).toBe("live")
    expect(r.round).toBe(17)
    expect(r.stale).toBe(true)
    expect(r.tv).toEqual({ host: "1.2.3.4", port: 27020 })
    expect(r.side1.result).toBe("playing")
    expect(r.side1.players[0]).toMatchObject({
      delta: null,
      me: true,
      mvp: false,
    })
    expect(r.side2.players[0].mvp).toBe(true)
  })
})
