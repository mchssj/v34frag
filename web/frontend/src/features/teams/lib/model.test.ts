import { describe, expect, it } from "vitest"

import {
  joinState,
  rankOf,
  resultFor,
  resultText,
  rolesMap,
  rosterGroups,
  titlesOf,
  winRate,
  eligibility,
} from "./model"
import type { MatchLike } from "./model"
import type { RosterEntry } from "../types"

const member = (alias: string, role: string, extra = {}): RosterEntry => ({
  player_id: alias,
  alias,
  photo_url: null,
  has_steam: true,
  elo: null,
  level: null,
  role,
  game_role: null,
  is_captain: false,
  joined_at: null,
  left_at: null,
  ...extra,
})

describe("rosterGroups", () => {
  it("agrupa en Activos, Suplentes y Coach y omite los vacíos", () => {
    const groups = rosterGroups([
      member("a", "player"),
      member("b", "coach"),
      member("c", "player"),
    ])
    expect(groups.map((g) => [g.label, g.members.map((m) => m.alias)])).toEqual(
      [
        ["Activos", ["a", "c"]],
        ["Coach", ["b"]],
      ]
    )
  })

  it("un rol desconocido cuenta como activo", () => {
    expect(rosterGroups([member("x", "otro")])[0].status).toBe("player")
  })
})

describe("winRate, rankOf y titlesOf", () => {
  it("% de victorias del récord oficial", () => {
    expect(
      winRate({
        official: { played: 11, won: 9, lost: 2, points: 270 },
        pcw: { played: 0, won: 0, lost: 0, points: 0 },
        events_played: 0,
      })
    ).toBe(82)
    expect(
      winRate({
        official: { played: 0, won: 0, lost: 0, points: 0 },
        pcw: { played: 0, won: 0, lost: 0, points: 0 },
        events_played: 0,
      })
    ).toBeNull()
  })

  it("posición en el ranking y títulos", () => {
    const ranking = [
      {
        position: 2,
        team: { id: "t1", name: "A", tag: null },
        played: 1,
        won: 1,
        lost: 0,
        points: 30,
        win_rate: null,
        trend: null,
        form: [],
      },
    ]
    expect(rankOf(ranking, "t1")).toBe(2)
    expect(rankOf(ranking, "otro")).toBeNull()
    const events = [
      { id: "e1", champion: { id: "t1", name: "A", tag: null } },
      { id: "e2", champion: { id: "t2", name: "B", tag: null } },
    ]
    expect(titlesOf(events, "t1").map((e) => e.id)).toEqual(["e1"])
  })
})

describe("rolesMap", () => {
  it("ubica a cada uno en el lugar de su puesto; varios por lugar, el resto aparte y sin el coach", () => {
    const { slots, others } = rolesMap([
      member("a", "player", { game_role: "AWPer" }),
      member("b", "player", { game_role: "AWPer" }),
      member("c", "player", { game_role: "Entry fragger" }),
      member("d", "sub", { game_role: "Rifler" }),
      member("e", "player"),
      member("f", "coach", { game_role: "IGL" }),
    ])
    expect(slots.AWPer.map((m) => m.alias)).toEqual(["a", "b"])
    expect(slots.Entry.map((m) => m.alias)).toEqual(["c"])
    expect(slots.IGL).toEqual([])
    expect(others.map((m) => m.alias)).toEqual(["d", "e"])
  })
})

describe("resultText", () => {
  it("nombra el resultado y el 3.er puesto cuando se sabe", () => {
    expect(resultText("champion", 1)).toBe("Campeón")
    expect(resultText("semifinal", 3)).toBe("3.er puesto")
    expect(resultText("semifinal", null)).toBe("Semifinal")
    expect(resultText("in_progress", null)).toBe("En curso")
  })
})

describe("resultFor", () => {
  const match = (over: Partial<MatchLike>): MatchLike =>
    ({
      id: "m1",
      kind: "official",
      status: "finished",
      label: "Semifinal",
      event: { name: "Liga Apertura" },
      side1: {
        name: null,
        team: { id: "t1", name: "Furia", tag: null },
        score: 2,
      },
      side2: {
        name: null,
        team: { id: "t2", name: "Brava", tag: null },
        score: 0,
      },
      winner_side: 1,
      ...over,
    }) as MatchLike

  it("desde cualquiera de los dos bandos", () => {
    expect(resultFor(match({}), "t1")).toMatchObject({
      opponent: "Brava",
      won: true,
      score: "2 : 0",
      context: "Liga Apertura · Semifinal",
    })
    expect(resultFor(match({}), "t2")).toMatchObject({
      opponent: "Furia",
      won: false,
      score: "0 : 2",
    })
  })

  it("en vivo, sin resultado todavía", () => {
    expect(
      resultFor(match({ status: "live", winner_side: null }), "t1")
    ).toMatchObject({
      won: null,
      live: true,
      context: "Liga Apertura · Semifinal · en vivo",
    })
  })
})

describe("joinState", () => {
  const base = {
    signedIn: true,
    isMember: false,
    members: 4,
    maxMembers: 10,
    hasRequest: false,
  }
  it("cubre todos los casos en orden de prioridad", () => {
    expect(joinState({ ...base, signedIn: false })).toBe("signin")
    expect(joinState({ ...base, isMember: true })).toBe("member")
    expect(joinState({ ...base, hasRequest: true })).toBe("sent")
    expect(joinState({ ...base, members: 10 })).toBe("full")
    expect(joinState(base)).toBe("join")
  })
})

describe("eligibility", () => {
  const mode = (code: string, players_per_team: number, missing: number) => ({
    code,
    name: code,
    players_per_team,
    missing,
  })
  it("junta los modos aptos y dice cuántos faltan para el más cercano", () => {
    expect(
      eligibility([
        mode("1v1", 1, 0),
        mode("2v2", 2, 0),
        mode("3v3", 3, 1),
        mode("5v5", 5, 3),
      ])
    ).toEqual({
      apt: "1v1 · 2v2",
      next: "Falta 1 para 3v3",
    })
  })
  it("apto para todo o para nada", () => {
    expect(eligibility([mode("1v1", 1, 0), mode("5v5", 5, 0)])).toEqual({
      apt: "1v1 · 5v5",
      next: null,
    })
    expect(eligibility([mode("5v5", 5, 4)])).toEqual({
      apt: null,
      next: "Faltan 4 para 5v5",
    })
    expect(eligibility([])).toEqual({ apt: null, next: null })
  })
})
