import { describe, expect, it } from "vitest"

import {
  crossOf,
  defaultPhase,
  destinationsOf,
  groupsOf,
  originOf,
  phasesOf,
  scoreFrom,
  swissGrid,
  swissOptions,
  wonBy,
} from "./bracket"
import type { EventMatch, Standing } from "../types"

const team = (n: number) => ({
  id: `t${n}`,
  name: `Equipo ${n}`,
  tag: `E${n}`,
  logo_url: null,
})

let seq = 0
function match(
  p: Partial<EventMatch> & { a?: number; b?: number; win?: 1 | 2 }
) {
  const { a, b, win, ...rest } = p
  return {
    id: `m${++seq}`,
    kind: "official",
    status: win ? "finished" : "upcoming",
    label: null,
    event: null,
    side1: {
      name: null,
      team: a ? team(a) : null,
      score: win ? (win === 1 ? 2 : 0) : null,
    },
    side2: {
      name: null,
      team: b ? team(b) : null,
      score: win ? (win === 2 ? 2 : 0) : null,
    },
    winner_side: win ?? null,
    best_of: 3,
    map: null,
    starts_at: null,
    played_at: null,
    end_reason: null,
    cancel_reason: null,
    review: null,
    demo_status: "none",
    parent_match_id: null,
    stage: "ko",
    phase: 1,
    grp: null,
    round: 1,
    pos: 1,
    bye: false,
    ...rest,
  } as EventMatch
}

const standing = (p: Partial<Standing> & { t: number }) => {
  const { t, ...rest } = p
  return {
    stage: "group",
    grp: 1,
    phase: 1,
    team: team(t),
    place: 1,
    tied: false,
    played: 0,
    won: 0,
    lost: 0,
    points: 0,
    rounds_for: 0,
    rounds_against: 0,
    rounds_diff: 0,
    buchholz: null,
    state: null,
    ...rest,
  } as Standing
}

describe("phasesOf y defaultPhase", () => {
  it("una fase por etapa de la plantilla, con playoffs aunque todavía no existan", () => {
    const groups = phasesOf(
      [match({ stage: "group", grp: 1, a: 1, b: 2, win: 1 })],
      "groups",
      {}
    )
    expect(groups.map((p) => [p.key, p.kind, p.status])).toEqual([
      ["groups", "groups", "done"],
      ["playoffs", "tree", "pending"],
    ])
    expect(groups[1].matches).toHaveLength(0)

    expect(phasesOf([], "single", {}).map((p) => p.key)).toEqual(["playoffs"])
    expect(phasesOf([], "double", {}).map((p) => p.label)).toEqual(["Llave"])
    expect(
      phasesOf(
        [match({ stage: "group_upper", grp: 1 }), match({ stage: "ko" })],
        "groups_double",
        {}
      ).map((p) => [p.kind, p.matches.length])
    ).toEqual([
      ["groups_double", 1],
      ["tree", 1],
    ])
  })

  it("suizo: un chip por fase configurada, aunque la fase 2 todavía no exista", () => {
    const phases = phasesOf(
      [match({ stage: "swiss", phase: 1, status: "live" })],
      "swiss",
      { stages: 2 }
    )
    expect(phases.map((p) => [p.key, p.label, p.status])).toEqual([
      ["swiss-1", "Fase suiza 1", "live"],
      ["swiss-2", "Fase suiza 2", "pending"],
      ["playoffs", "Playoffs", "pending"],
    ])
    expect(phasesOf([], "swiss", {}).map((p) => p.label)).toEqual([
      "Fase suiza",
      "Playoffs",
    ])
  })

  it("abre en la que está en vivo, si no en la que tiene partidas por jugar, si no en la última", () => {
    const done = match({ stage: "group", a: 1, b: 2, win: 1 })
    const up = match({ stage: "ko", a: 1, b: 2 })
    expect(defaultPhase(phasesOf([done, up], "groups", {})).key).toBe(
      "playoffs"
    )
    const live = match({ stage: "group", status: "live" })
    expect(defaultPhase(phasesOf([live, up], "groups", {})).key).toBe("groups")
    const final = match({ stage: "ko", a: 1, b: 2, win: 2 })
    expect(defaultPhase(phasesOf([done, final], "groups", {})).key).toBe(
      "playoffs"
    )
    expect(defaultPhase(phasesOf([done], "groups", {})).key).toBe("groups")
  })
})

describe("originOf", () => {
  const qf = [1, 2, 3, 4].map((pos) =>
    match({ stage: "ko", round: 1, pos, label: "Cuartos de final" })
  )
  const sf = [1, 2].map((pos) =>
    match({ stage: "ko", round: 2, pos, label: "Semifinal" })
  )
  const final = match({ stage: "ko", round: 3, pos: 1, label: "Final" })
  const third = match({
    stage: "third",
    round: 1,
    pos: 1,
    label: "3.er puesto",
  })
  const all = [...qf, ...sf, final, third]

  it("en la llave, el ganador de la partida anterior (con número si la ronda tiene varias)", () => {
    expect(originOf(sf[1], 1, all)).toBe("Ganador de Cuartos de final 3")
    expect(originOf(sf[1], 2, all)).toBe("Ganador de Cuartos de final 4")
    expect(originOf(final, 2, all)).toBe("Ganador de Semifinal 2")
    expect(originOf(third, 1, all)).toBe("Perdedor de Semifinal 1")
    expect(originOf(qf[0], 1, all)).toBeNull()
  })

  it("lo que manda el backend gana, y un lado con equipo no tiene origen", () => {
    const m = match({ stage: "lower", round: 2, a: 1 })
    m.side2.name = "Perdedor de la final del upper"
    expect(originOf(m, 2, [m])).toBe("Perdedor de la final del upper")
    expect(originOf(m, 1, [m])).toBeNull()
    expect(originOf(match({ stage: "lower", round: 2 }), 1, [])).toBeNull()
  })
})

describe("destinationsOf", () => {
  it("doble eliminación: el que pierde en el upper baja a su ronda del lower; el que pierde en el lower queda afuera", () => {
    const u1 = match({ stage: "upper", round: 1, a: 1, b: 2, win: 1 })
    const uf = match({ stage: "upper", round: 2, a: 1, b: 3, win: 1 })
    const l1 = match({ stage: "lower", round: 1, a: 2, b: 4, win: 2 })
    const lf = match({ stage: "lower", round: 2, a: 3, b: 4, win: 1 })
    const marks = destinationsOf([u1, uf, l1, lf], "double")
    expect(marks.get(u1.id)).toEqual([null, { text: "↓ L1", tone: "down" }])
    expect(marks.get(uf.id)).toEqual([
      { text: "→ GF", tone: "up" },
      { text: "↓ L2", tone: "down" },
    ])
    expect(marks.get(l1.id)).toEqual([{ text: "✕", tone: "out" }, null])
    expect(marks.get(lf.id)).toEqual([
      { text: "→ GF", tone: "up" },
      { text: "✕", tone: "out" },
    ])
  })

  it("grupos de doble eliminación: clasificados y puesto de los eliminados según las posiciones", () => {
    const uf = match({
      stage: "group_upper",
      grp: 1,
      round: 2,
      a: 1,
      b: 3,
      win: 1,
    })
    const lf = match({
      stage: "group_lower",
      grp: 1,
      round: 2,
      a: 3,
      b: 2,
      win: 1,
    })
    const rows = [
      standing({ t: 1, stage: "group_double", place: 1, state: "qualified" }),
      standing({ t: 3, stage: "group_double", place: 2, state: "qualified" }),
      standing({ t: 2, stage: "group_double", place: 3, state: "eliminated" }),
    ]
    const marks = destinationsOf([uf, lf], "groups_double", rows)
    expect(marks.get(uf.id)).toEqual([
      { text: "→ PO", tone: "up" },
      { text: "↓ L2", tone: "down" },
    ])
    expect(marks.get(lf.id)).toEqual([
      { text: "→ PO", tone: "up" },
      { text: "✕ 3.º", tone: "out" },
    ])
  })
})

/** Simula un suizo: empareja dentro de cada récord y gana el de número más bajo. */
function simulateSwiss(size: number, wins: number, playedRounds: number) {
  const rec = new Map(
    Array.from({ length: size }, (_, i) => [i + 1, { w: 0, l: 0 }])
  )
  const out: EventMatch[] = []
  for (let r = 1; r <= playedRounds; r++) {
    const active = [...rec.entries()].filter(
      ([, x]) => x.w < wins && x.l < wins
    )
    const buckets = new Map<string, number[]>()
    for (const [t, x] of active) {
      const k = `${x.w}:${x.l}`
      buckets.set(k, [...(buckets.get(k) ?? []), t])
    }
    let pos = 0
    for (const list of buckets.values())
      for (let i = 0; i < list.length / 2; i++) {
        const a = list[i]
        const b = list[list.length - 1 - i]
        out.push(
          match({
            stage: "swiss",
            round: r,
            pos: ++pos,
            a,
            b,
            win: a < b ? 1 : 2,
            best_of: 1,
          })
        )
        rec.get(Math.min(a, b))!.w++
        rec.get(Math.max(a, b))!.l++
      }
  }
  return out
}

const shape = (g: ReturnType<typeof swissGrid>) =>
  g.rounds.map((r) => r.buckets.map((b) => `${b.record}x${b.matches.length}`))

describe("swissGrid", () => {
  it("16 equipos a 3 victorias, completo: récords por ronda y las franjas llenas", () => {
    const g = swissGrid(simulateSwiss(16, 3, 5), { wins: 3 })
    expect(shape(g)).toEqual([
      ["0:0x8"],
      ["1:0x4", "0:1x4"],
      ["2:0x2", "1:1x4", "0:2x2"],
      ["2:1x3", "1:2x3"],
      ["2:2x3"],
    ])
    expect(g.qualified.map((q) => [q.record, q.slots, q.teams.length])).toEqual(
      [
        ["3:0", 2, 2],
        ["3:1", 3, 3],
        ["3:2", 3, 3],
      ]
    )
    expect(
      g.eliminated.map((q) => [q.record, q.slots, q.teams.length])
    ).toEqual([
      ["0:3", 2, 2],
      ["1:3", 3, 3],
      ["2:3", 3, 3],
    ])
    expect(
      g.rounds.flatMap((r) => r.buckets).every((b) => !b.matches.includes(null))
    ).toBe(true)
  })

  it("fase en curso: las rondas que no existen se proyectan como partidas por armar", () => {
    const played = simulateSwiss(16, 3, 2)
    // La ronda 2 a medias: una partida todavía en juego.
    const last = played.at(-1)!
    Object.assign(last, { status: "live", winner_side: null })
    const g = swissGrid(played, { wins: 3, bo: 1, boDecisive: 3 })
    expect(shape(g)).toEqual([
      ["0:0x8"],
      ["1:0x4", "0:1x4"],
      ["2:0x2", "1:1x4", "0:2x2"],
      ["2:1x3", "1:2x3"],
      ["2:2x3"],
    ])
    const r3 = g.rounds[2].buckets
    expect(r3.every((b) => b.matches.every((m) => m === null))).toBe(true)
    expect(r3.map((b) => b.bo)).toEqual([3, 1, 3])
    expect(g.qualified.every((q) => q.teams.length === 0)).toBe(true)
  })

  it("8 equipos a 2 victorias", () => {
    const g = swissGrid(simulateSwiss(8, 2, 3), { wins: 2 })
    expect(shape(g)).toEqual([["0:0x4"], ["1:0x2", "0:1x2"], ["1:1x2"]])
    expect(g.qualified.map((q) => [q.record, q.slots, q.teams.length])).toEqual(
      [
        ["2:0", 2, 2],
        ["2:1", 2, 2],
      ]
    )
  })

  it("lee la configuración del torneo", () => {
    expect(swissOptions({})).toEqual({
      wins: 3,
      size: undefined,
      bo: 1,
      boDecisive: 3,
    })
    expect(swissOptions({ wins: 2, size: 8, bo: 3, bo_decisive: 5 })).toEqual({
      wins: 2,
      size: 8,
      bo: 3,
      boDecisive: 5,
    })
  })
})

describe("groupsOf y cruces", () => {
  const m1 = match({
    stage: "group",
    grp: 1,
    round: 1,
    pos: 1,
    a: 1,
    b: 2,
    win: 2,
  })
  const m2 = match({ stage: "group", grp: 1, round: 2, pos: 1, a: 2, b: 1 })
  const m3 = match({ stage: "group", grp: 2, round: 1, pos: 1, a: 3, b: 4 })

  it("un grupo por número, con fechas y los equipos en el orden de la tabla", () => {
    const groups = groupsOf(
      [m3, m2, m1],
      [standing({ t: 2, place: 1 }), standing({ t: 1, place: 2 })]
    )
    expect(groups.map((g) => [g.title, g.rounds.length])).toEqual([
      ["Grupo A", 2],
      ["Grupo B", 1],
    ])
    expect(groups[0].teams.map((t) => t.id)).toEqual(["t2", "t1"])
    expect(groups[1].teams.map((t) => t.id)).toEqual(["t3", "t4"])
  })

  it("los cruces devuelven ida y vuelta, y el resultado se lee desde cada equipo", () => {
    const [g] = groupsOf([m1, m2], [])
    expect(crossOf(g, "t1", "t2")).toEqual([m1, m2])
    expect(scoreFrom(m1, "t2")).toBe("2:0")
    expect(scoreFrom(m1, "t1")).toBe("0:2")
    expect(wonBy(m1, "t2")).toBe(true)
    expect(wonBy(m1, "t1")).toBe(false)
    expect(wonBy(m2, "t1")).toBeNull()
  })
})
