import { describe, expect, it } from "vitest"

import {
  boText,
  buildBracket,
  closesText,
  ctaFor,
  dateRange,
  formatText,
  liveText,
  modeText,
  progressRatio,
  registrationClosed,
  qualifies,
  rulesOf,
  sidesOf,
  sortEvents,
  standingTables,
  DEFAULT_RULES,
  type MyTeamRef,
} from "./model"
import type { EventMatch, Standing } from "./queries"

const team = (n: number) => ({ id: `t${n}`, name: `Equipo ${n}`, tag: `E${n}` })

function match(p: Partial<EventMatch> & { a?: number; b?: number }) {
  const { a, b, ...rest } = p
  return {
    id: `m-${Math.random()}`,
    kind: "official",
    status: "upcoming",
    label: null,
    event: null,
    side1: { name: null, team: a ? team(a) : null, score: null },
    side2: { name: null, team: b ? team(b) : null, score: null },
    winner_side: null,
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

const standing = (p: Partial<Standing>) =>
  ({
    stage: "group",
    grp: 1,
    phase: 1,
    team: team(1),
    place: 1,
    tied: false,
    played: 3,
    won: 3,
    lost: 0,
    points: 9,
    rounds_for: 39,
    rounds_against: 24,
    rounds_diff: 15,
    buchholz: null,
    state: null,
    ...p,
  }) as Standing

describe("formato", () => {
  it("arma el BO con lo que calcula el backend, y null sin BO", () => {
    expect(boText({ bo: 3, bo_final: 5 })).toBe("BO3 · Final BO5")
    expect(boText({ bo: 1, bo_final: null })).toBe("BO1")
    expect(boText({ bo: null, bo_final: null })).toBeNull()
  })

  it("describe el modo de juego con activos y suplentes", () => {
    expect(
      modeText({ game_mode: "5v5", players_per_team: 5, subs_max: 2 })
    ).toBe("5v5 · 5 activos + hasta 2 suplentes")
    expect(
      modeText({ game_mode: "1v1", players_per_team: 1, subs_max: 0 })
    ).toBe("1v1 · 1 activo, sin suplentes")
  })

  it("suma los grupos y los clasificados al formato", () => {
    expect(formatText("groups", { groups: 4, advance: 2 })).toBe(
      "Grupos + playoffs · 4 grupos, clasifican 2"
    )
    expect(formatText("swiss", { stages: 3, size: 16 })).toBe(
      "Suizo + playoffs · 3 fases de 16"
    )
    expect(formatText("single", {})).toBe("Eliminación directa")
  })

  it("arma el rango de fechas", () => {
    expect(dateRange("2025-07-05", "2025-08-02")).toBe("05 jul – 02 ago")
    expect(dateRange("2025-07-05", null)).toBe("Desde el 05 jul")
    expect(dateRange(null, null)).toBe("Fechas por definir")
  })

  it("ordena Inscripciones → En curso → Finalizado → Cancelado", () => {
    const list = sortEvents([
      { status: "finished" as const, n: 1 },
      { status: "cancelled" as const, n: 2 },
      { status: "registration" as const, n: 3 },
      { status: "in_progress" as const, n: 4 },
      { status: "registration" as const, n: 5 },
    ])
    expect(list.map((e) => e.n)).toEqual([3, 5, 4, 1, 2])
  })
})

describe("cierre de inscripciones", () => {
  const now = new Date("2026-11-01T12:00:00Z")

  it("cuenta lo que falta y sabe si ya cerró", () => {
    expect(closesText("2026-11-03T12:00:00Z", now)).toBe("cierra en 2 d")
    expect(closesText("2026-11-01T17:00:00Z", now)).toBe("cierra en 5 h")
    expect(closesText("2026-11-01T12:20:00Z", now)).toBe("cierra en 20 min")
    expect(closesText("2026-11-01T11:00:00Z", now)).toBe("cerrado")
    expect(
      registrationClosed(
        { registration_closes_at: "2026-11-01T11:00:00Z" },
        now
      )
    ).toBe(true)
    expect(registrationClosed({ registration_closes_at: null }, now)).toBe(
      false
    )
  })
})

describe("avance y partida en vivo", () => {
  it("avance sobre las partidas armadas; sin fixture, 0", () => {
    expect(progressRatio({ played: 3, total: 6 })).toBe(0.5)
    expect(progressRatio({ played: 0, total: 0 })).toBe(0)
    expect(progressRatio(null)).toBe(0)
  })

  it("etapa, mapa de la serie y mapa en juego", () => {
    expect(
      liveText({
        id: "m",
        label: "Semifinal",
        map: "de_dust2",
        map_index: 2,
        maps_total: 3,
      })
    ).toBe("Semifinal · Mapa 2 de 3 · de_dust2")
    expect(
      liveText({
        id: "m",
        label: "Final",
        map: null,
        map_index: 1,
        maps_total: 1,
      })
    ).toBe("Final")
  })
})

describe("buildBracket", () => {
  it("eliminación directa: una llave sin título, columnas por ronda y filas por posición", () => {
    const [s, ...rest] = buildBracket(
      [
        match({ round: 1, pos: 2, label: "Semifinal" }),
        match({ round: 1, pos: 1, label: "Semifinal" }),
        match({ round: 2, pos: 1, label: "Final", best_of: 5 }),
      ],
      "single"
    )
    expect(rest).toHaveLength(0)
    expect(s.title).toBeNull()
    expect(s.final).toBe(true)
    expect(s.columns.map((c) => [c.title, c.bo, c.games.length])).toEqual([
      ["Semifinal", 3, 2],
      ["Final", 5, 1],
    ])
    expect(s.columns[0].games.map((g) => g.pos)).toEqual([1, 2])
  })

  it("doble eliminación: upper, lower y gran final (sin repetir el título), que termina en el campeón", () => {
    const sections = buildBracket(
      [
        match({ stage: "grand", label: "Gran final" }),
        match({ stage: "lower", label: "Lower · ronda 1" }),
        match({ stage: "upper", label: "Upper · ronda 1" }),
      ],
      "double"
    )
    expect(sections.map((s) => [s.title, s.final])).toEqual([
      ["Upper", false],
      ["Lower", false],
      [null, true],
    ])
  })

  it("grupos: deja afuera la fase de grupos; con doble eliminación, una sección por grupo", () => {
    expect(
      buildBracket(
        [match({ stage: "group", grp: 1 }), match({ stage: "ko" })],
        "groups"
      ).map((s) => s.key)
    ).toEqual(["0:ko"])

    const sections = buildBracket(
      [
        match({ stage: "ko", label: "Semifinal" }),
        match({ stage: "upper", grp: 2, label: "Grupo B · upper · ronda 1" }),
        match({ stage: "upper", grp: 1, label: "Grupo A · final del upper" }),
      ],
      "groups_double"
    )
    expect(sections.map((s) => s.title)).toEqual([
      "Grupo A · upper",
      "Grupo B · upper",
      "Playoffs",
    ])
    expect(sections[0].columns[0].title).toBe("Final del upper")
  })
})

describe("sidesOf", () => {
  it("marca ganador y perdedor, y 'Por definir' sin equipo", () => {
    const [a, b] = sidesOf(
      match({
        a: 1,
        b: 2,
        status: "finished",
        winner_side: 2,
        side1: { name: null, team: team(1), score: 0 },
        side2: { name: null, team: team(2), score: 2 },
      })
    )
    expect([a.lost, b.won]).toEqual([true, true])
    expect(sidesOf(match({ a: 1 }))[1].name).toBe("Por definir")
  })
})

describe("posiciones", () => {
  it("una tabla por grupo, ordenada por puesto", () => {
    const tables = standingTables([
      standing({ grp: 2, place: 1 }),
      standing({ grp: 1, place: 2 }),
      standing({ grp: 1, place: 1 }),
    ])
    expect(tables.map((t) => t.title)).toEqual(["Grupo B", "Grupo A"])
    expect(tables[1].rows.map((r) => r.place)).toEqual([1, 2])
  })

  it("clasifica por puesto en grupos y por estado en el suizo", () => {
    expect(qualifies(standing({ place: 2 }), 2)).toBe(true)
    expect(qualifies(standing({ place: 3 }), 2)).toBe(false)
    expect(
      qualifies(standing({ stage: "swiss", place: 9, state: "qualified" }), 2)
    ).toBe(true)
  })
})

describe("rulesOf", () => {
  it("un ítem por línea sin numeración; sin texto, las de la liga", () => {
    expect(rulesOf("1. Roster de 5.\n\n- Veto en la sala.")).toEqual([
      "Roster de 5.",
      "Veto en la sala.",
    ])
    expect(rulesOf(null)).toBe(DEFAULT_RULES)
  })
})

describe("ctaFor", () => {
  const leader: MyTeamRef = {
    id: "t1",
    name: "Furia Sur",
    tag: "FUR",
    isLeader: true,
  }
  const member: MyTeamRef = { ...leader, isLeader: false }
  const now = new Date("2026-11-01T12:00:00Z")
  const base = {
    status: "registration" as const,
    teams: 3,
    max_teams: 8,
    champion: null,
    ends_on: null,
    registration_closes_at: null,
    live_match: null,
    current_stage: null,
  }
  const none = new Set<string>()

  it("líder: inscribir, ya inscripto o cupo completo", () => {
    expect(
      ctaFor({ event: base, myTeams: [leader], registeredIds: none, now })
    ).toEqual({ kind: "register", teams: [leader], free: 5 })
    expect(
      ctaFor({
        event: base,
        myTeams: [leader],
        registeredIds: new Set(["t1"]),
        now,
      })
    ).toEqual({ kind: "registered", team: leader, closed: false })
    expect(
      ctaFor({
        event: { ...base, teams: 8 },
        myTeams: [leader],
        registeredIds: none,
        now,
      }).kind
    ).toBe("full")
  })

  it("pasado el cierre: el líder sin inscribir ve 'cerradas'; el inscripto, sin cambios", () => {
    const closed = { ...base, registration_closes_at: "2026-11-01T11:00:00Z" }
    expect(
      ctaFor({ event: closed, myTeams: [leader], registeredIds: none, now })
    ).toEqual({ kind: "closed", at: "2026-11-01T11:00:00Z" })
    expect(
      ctaFor({
        event: closed,
        myTeams: [leader],
        registeredIds: new Set(["t1"]),
        now,
      })
    ).toEqual({ kind: "registered", team: leader, closed: true })
  })

  it("sin liderazgo: pedirle al líder; sin equipo: no-team", () => {
    expect(
      ctaFor({ event: base, myTeams: [member], registeredIds: none, now })
    ).toEqual({ kind: "ask-leader", team: member, registered: false })
    expect(
      ctaFor({ event: base, myTeams: [], registeredIds: none, now }).kind
    ).toBe("no-team")
  })

  it("en curso: en vivo o ver partidas; finalizado: campeón", () => {
    const live = {
      id: "m1",
      label: "Semifinal",
      map: "de_dust2",
      map_index: 2,
      maps_total: 3,
    }
    expect(
      ctaFor({
        event: { ...base, status: "in_progress", live_match: live },
        myTeams: [],
        registeredIds: none,
        now,
      })
    ).toEqual({ kind: "live", match: live })
    expect(
      ctaFor({
        event: { ...base, status: "in_progress", current_stage: "Final" },
        myTeams: [],
        registeredIds: none,
        now,
      })
    ).toEqual({ kind: "matches", stage: "Final" })
    expect(
      ctaFor({
        event: {
          ...base,
          status: "finished",
          champion: team(1),
          ends_on: "2025-08-02",
        },
        myTeams: [],
        registeredIds: none,
        now,
      }).kind
    ).toBe("champion")
  })
})
