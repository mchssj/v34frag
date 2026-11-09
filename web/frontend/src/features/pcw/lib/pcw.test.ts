import { describe, expect, it } from "vitest"

import type { PcwPlayer, PcwPost, PcwResult } from "../types"
import {
  agoLabel,
  avgElo,
  balance,
  countdown,
  filterPosts,
  headToHead,
  icsFor,
  reliabilityPct,
  rosterIssues,
  timeBucket,
  whenLabel,
} from "./pcw"

// Domingo 8 de noviembre de 2026, 20:00 hora local.
const NOW = new Date(2026, 10, 8, 20, 0, 0)
const at = (h: number, m = 0, day = 8) =>
  new Date(2026, 10, day, h, m).toISOString()

const player = (id: string, elo: number, guest = false): PcwPlayer => ({
  id,
  alias: id,
  elo,
  guest,
})

const post = (over: Partial<PcwPost>): PcwPost => ({
  id: "p",
  by: "u",
  best_of: 3,
  starts_at: null,
  note: null,
  created_at: at(19),
  map_pool: null,
  side: { name: "Pick de x", team: null, roster: [player("a", 1000)] },
  invited: null,
  discord: false,
  reliability: null,
  ...over,
})

describe("whenLabel", () => {
  it("sin hora es a convenir", () => {
    expect(whenLabel(null, NOW)).toBe("A convenir")
  })
  it("cerca de ahora, minutos, horas, hoy, mañana y otro día", () => {
    expect(whenLabel(at(20, 10), NOW)).toBe("Ahora")
    expect(whenLabel(at(20, 40), NOW)).toBe("En 40 min")
    expect(whenLabel(at(22), NOW)).toBe("En 2 h")
    expect(whenLabel(at(23, 30), NOW)).toBe("Hoy 23:30")
    expect(whenLabel(at(21, 0, 9), NOW)).toBe("Mañana 21:00")
    expect(whenLabel(at(21, 0, 11), NOW)).toBe("mié 11/11 21:00")
  })
})

describe("agoLabel y countdown", () => {
  it("dice hace cuánto", () => {
    expect(agoLabel(at(19, 35), NOW)).toBe("hace 25 min")
    expect(agoLabel(at(17), NOW)).toBe("hace 3 h")
  })
  it("cuenta hacia atrás y se apaga al llegar", () => {
    expect(countdown(at(21, 5), NOW)).toBe("1 h 05 min")
    expect(countdown(new Date(NOW.getTime() + 90_000).toISOString(), NOW)).toBe(
      "1:30"
    )
    expect(countdown(at(19), NOW)).toBeNull()
    expect(countdown(at(21, 0, 9), NOW)).toBeNull()
    expect(countdown(null, NOW)).toBeNull()
  })
})

describe("timeBucket", () => {
  it("separa ahora, hoy, más adelante y a convenir", () => {
    expect(timeBucket(at(20, 50), NOW)).toBe("now")
    expect(timeBucket(at(23), NOW)).toBe("today")
    expect(timeBucket(at(20, 0, 9), NOW)).toBe("later")
    expect(timeBucket(null, NOW)).toBe("tbd")
  })
})

describe("avgElo y balance", () => {
  it("promedia solo a los que tienen cuenta", () => {
    expect(
      avgElo([player("a", 1000), player("b", 1200), player("g", 0, true)])
    ).toBe(1100)
    expect(avgElo([])).toBe(0)
  })
  it("parejo hasta 75 y si no dice quién está arriba", () => {
    expect(balance(1000, 1070).tone).toBe("even")
    expect(balance(1000, 1120)).toMatchObject({
      label: "Ellos +120",
      tone: "up",
    })
    expect(balance(1200, 1000)).toMatchObject({
      label: "Ustedes +200",
      tone: "down",
    })
  })
})

describe("filterPosts", () => {
  const posts = [
    post({ id: "bo1", best_of: 1, starts_at: at(20, 30) }),
    post({
      id: "team",
      starts_at: at(23),
      side: {
        name: "x",
        team: { id: "t", name: "T", tag: "T" },
        roster: [player("a", 1500)],
      },
    }),
    post({ id: "later", best_of: 5, starts_at: at(21, 0, 10) }),
  ]
  const all = { bo: null, time: "all", myLevel: false, kind: "all" } as const
  const ids = (f: Parameters<typeof filterPosts>[1]) =>
    filterPosts(posts, f, 1000, NOW).map((p) => p.id)

  it("filtra por formato, horario, tipo y nivel", () => {
    expect(ids(all)).toEqual(["bo1", "team", "later"])
    expect(ids({ ...all, bo: 5 })).toEqual(["later"])
    expect(ids({ ...all, time: "now" })).toEqual(["bo1"])
    expect(ids({ ...all, time: "today" })).toEqual(["team"])
    expect(ids({ ...all, kind: "team" })).toEqual(["team"])
    expect(ids({ ...all, kind: "mix" })).toEqual(["bo1", "later"])
    expect(ids({ ...all, myLevel: true })).toEqual(["bo1", "later"])
  })
})

describe("rosterIssues", () => {
  const four = ["a", "b", "c", "d"].map((id) => player(id, 1000))
  it("pide 4 con cuenta y como mucho 7", () => {
    expect(rosterIssues(four)).toEqual([])
    expect(rosterIssues([...four.slice(0, 3), player("g", 0, true)])).toEqual([
      "Te falta 1 jugador con cuenta (mínimo 4).",
    ])
    expect(rosterIssues(four.slice(0, 2))[0]).toMatch(/faltan 2 jugadores/)
    expect(
      rosterIssues([
        ...four,
        ...["e", "f", "g", "h"].map((id) => player(id, 1)),
      ])
    ).toEqual(["El roster es de hasta 7 jugadores."])
  })
  it("la sanción va primero y el formato tiene que estar habilitado", () => {
    expect(
      rosterIssues(four, { banned: "Sancionado", bo: 5, formats: [1, 3] })
    ).toEqual(["Sancionado", "El formato BO5 no está habilitado para las PCW."])
  })
})

describe("headToHead", () => {
  const t = (id: string) => ({ id, name: id, tag: null })
  const r = (
    day: number,
    a: string,
    b: string,
    score: [number, number]
  ): PcwResult => ({
    id: `${day}`,
    at: at(20, 0, day),
    a: t(a),
    b: t(b),
    score,
  })
  it("cuenta victorias desde mi lado, con las más nuevas primero", () => {
    const res = [
      r(1, "us", "them", [2, 1]),
      r(2, "them", "us", [2, 0]),
      r(3, "us", "them", [1, 2]),
      r(4, "us", "other", [2, 0]),
    ]
    expect(headToHead(res, "us", "them")).toEqual({
      wins: 1,
      losses: 2,
      label: "1-2 en las últimas 3",
    })
    expect(headToHead(res, "us", "them", 1)?.label).toBe("0-1 en la última")
    expect(headToHead(res, "us", "nadie")).toBeNull()
  })
})

describe("reliabilityPct", () => {
  it("jugadas sobre acordadas; sin datos, 100", () => {
    expect(reliabilityPct({ played: 18, cancelled: 1, abandoned: 1 })).toBe(90)
    expect(reliabilityPct({ played: 0, cancelled: 0, abandoned: 0 })).toBe(100)
  })
})

describe("icsFor", () => {
  it("arma un evento con aviso 15 min antes y escapa el título", () => {
    const ics = icsFor({
      id: "m1",
      title: "PCW, BO3; vs Rivales",
      startsAt: "2026-11-08T23:00:00.000Z",
      bestOf: 3,
      url: "https://cmleague.lat/match/m1",
      now: new Date("2026-11-08T20:00:00Z"),
    })
    expect(ics).toContain("DTSTART:20261108T230000Z")
    expect(ics).toContain("DTEND:20261109T011500Z")
    expect(ics).toContain("SUMMARY:PCW\\, BO3\\; vs Rivales")
    expect(ics).toContain("TRIGGER:-PT15M")
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR")
  })
})
