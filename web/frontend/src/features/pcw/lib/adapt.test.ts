import { describe, expect, it } from "vitest"

import type { Schemas } from "@/api/client"
import type { SeriesDetail } from "@/features/series/lib/series"
import type { MatchBooking } from "@/features/series/types/booking"
import {
  contextPlayers,
  seriesToMatch,
  toMatch,
  toPost,
  type ApiMyPcwMatch,
} from "./adapt"

// De la API a la página de PCW (bitácora 2026-11-08-pcw-real).

const side = (over: Partial<Schemas["PcwSide"]> = {}): Schemas["PcwSide"] => ({
  team_id: "s1",
  name: "Vértigo",
  plays_as: { id: "t1", name: "Vértigo", tag: "VTG" },
  rank: 6,
  roster: [
    { player_id: "p1", alias: "kyan", guest: false, elo: 1240 },
    { player_id: null, alias: "Suplente", guest: true, elo: null },
  ],
  ...over,
})

const summary = (n: string, score: number | null = null) => ({
  name: n,
  team: { id: `side-${n}`, name: n, tag: null },
  score,
})

const myMatch = (over: Partial<ApiMyPcwMatch> = {}): ApiMyPcwMatch => ({
  id: "m1",
  status: "upcoming",
  best_of: 3,
  starts_at: "2026-11-09T20:00:00Z",
  played_at: null,
  winner_side: null,
  side1: summary("Vértigo"),
  side2: summary("Nexus"),
  my_side: 2,
  booking: null,
  pcw_sides: {
    "1": side(),
    "2": side({ team_id: "s2", name: "Nexus", plays_as: null, rank: null }),
  },
  ...over,
})

describe("toPost", () => {
  it("el bando con su equipo, su puesto y el roster (el invitado sin ELO)", () => {
    const p = toPost({
      id: "post",
      by: { user_id: "u1", alias: "kyan" },
      best_of: 3,
      maps: null,
      starts_at: null,
      note: "serio",
      status: "open",
      match_id: null,
      created_at: "2026-11-08T20:00:00Z",
      map_pool: ["de_dust2"],
      side: side(),
      my_offer: {
        id: "o1",
        starts_at: null,
        created_at: "2026-11-08T20:01:00Z",
      },
    })
    expect(p.side.team).toEqual({
      id: "t1",
      name: "Vértigo",
      tag: "VTG",
      rank: 6,
    })
    expect(p.side.roster[1]).toMatchObject({
      alias: "Suplente",
      guest: true,
      elo: 0,
    })
    expect(p.my_offer).toEqual({
      id: "o1",
      created_at: "2026-11-08T20:01:00Z",
      proposed_at: null,
    })
    expect(p).toMatchObject({
      invited: null,
      discord: false,
      reliability: null,
    })
  })
})

describe("toMatch", () => {
  it("mi lado es 'us' aunque sea el equipo 2", () => {
    const m = toMatch(myMatch())
    expect(m.us.name).toBe("Nexus")
    expect(m.them.team?.id).toBe("t1")
    expect(m.status).toBe("waiting")
    expect(m.booking).toBeNull()
  })

  it("listos: los míos, los dos (con la sala) y el rival solo", () => {
    expect(
      toMatch(
        myMatch({ booking: { status: "ready", ready1: false, ready2: true } })
      ).status
    ).toBe("ready_us")
    const both = toMatch(
      myMatch({ booking: { status: "veto", ready1: true, ready2: true } })
    )
    expect(both.status).toBe("ready_both")
    expect(both.booking?.step).toBe("veto")
    expect(
      toMatch(
        myMatch({ booking: { status: "ready", ready1: true, ready2: false } })
      ).status
    ).toBe("waiting")
  })

  it("terminada: ganada o perdida y el marcador desde mi lado", () => {
    const m = toMatch(
      myMatch({
        status: "finished",
        winner_side: 2,
        side1: summary("Vértigo", 1),
        side2: summary("Nexus", 2),
      })
    )
    expect(m.status).toBe("won")
    expect(m.score).toEqual([2, 1])
  })
})

describe("contextPlayers", () => {
  it("sin contexto: una ficha vacía y sin equipo", () => {
    const c = contextPlayers(undefined)
    expect(c.team).toBeNull()
    expect(c.plantel).toEqual([])
  })
  it("mi equipo, su plantel y mis amigos", () => {
    const c = contextPlayers({
      vip: true,
      me: { player_id: "p1", alias: "kyan", elo: 1240 },
      team: {
        id: "t1",
        name: "Vértigo",
        tag: "VTG",
        logo_url: null,
        rank: 6,
        ban_until: null,
        plantel: [
          { player_id: "p1", alias: "kyan", elo: 1240, has_account: true },
        ],
      },
      friends: [
        { player_id: "p9", alias: "benja", elo: null, teammate: false },
      ],
    })
    expect(c.me).toEqual({ id: "p1", alias: "kyan", elo: 1240 })
    expect(c.team?.rank).toBe(6)
    expect(c.friends[0]).toEqual({
      id: "p9",
      alias: "benja",
      elo: 0,
      team: false,
    })
  })
})

describe("seriesToMatch", () => {
  const detail = {
    id: "m1",
    status: "upcoming",
    best_of: 3,
    starts_at: null,
    side1: {
      name: "Vértigo",
      team: { id: "s1", name: "Vértigo", tag: null },
      score: 0,
    },
    side2: {
      name: "Nexus",
      team: { id: "s2", name: "Nexus", tag: null },
      score: 0,
    },
    games: [{ score1: 13, score2: 9 }],
    roster1: [{ player_id: "p1", alias: "kyan", guest: false }],
    roster2: [{ player_id: "p2", alias: "zeta", guest: false }],
    veto: {
      pool: [{ name: "de_dust2" }, { name: "de_cache" }, { name: "de_nuke" }],
      actions: [{ seq: 1, team_id: "s2", map: "de_nuke", action: "ban" }],
    },
  } as unknown as SeriesDetail
  const mb = {
    can_veto: true,
    booking: {
      status: "assigned",
      map_no: 2,
      side_n1: 4,
      side_n2: 3,
      queue_position: null,
      veto_deadline: null,
      wait_deadline: "2026-11-09T20:15:00Z",
      abandoned_side: null,
      server: { id: "sv", name: "CMLeague #1", region: null },
      connection: { address: "1.2.3.4:27015", password: "x", url: "steam://" },
    },
  } as unknown as MatchBooking

  it("el equipo 1 es 'us': veto, espera para entrar, servidor y mapas jugados", () => {
    const m = seriesToMatch(detail, mb, null)
    const b = m.booking!
    expect(b.step).toBe("wait")
    expect(b.actions).toEqual([{ map: "de_nuke", kind: "ban", by: "them" }])
    expect(b.pool).toEqual(["de_dust2", "de_cache", "de_nuke"])
    expect(b.deadline).toBe("2026-11-09T20:15:00Z")
    expect(b.server).toEqual({
      name: "CMLeague #1",
      address: "1.2.3.4:27015",
      password: "x",
    })
    expect(b.present).toEqual([4, 3])
    expect(b.scores).toEqual([[13, 9]])
    expect(m.us.roster[0]?.alias).toBe("kyan")
  })
})
