import { describe, expect, it } from "vitest"

import {
  barPct,
  compareWinner,
  countdown,
  fmt2,
  fmtPct,
  roleCountry,
  teamTag,
  teamTrend,
} from "./labels"
import {
  compareSearchSchema,
  playerRankingSearchSchema,
  teamRankingSearchSchema,
  toPlayerRankingQuery,
  toStandingsQuery,
  toTeamRankingQuery,
} from "./search"

describe("labels", () => {
  it("rol y país omiten lo que falta (perfil privado)", () => {
    expect(roleCountry("AWPer", "Argentina")).toBe("AWPer · Argentina")
    expect(roleCountry(null, "Chile")).toBe("Chile")
    expect(roleCountry(null, null)).toBeNull()
  })

  it("números null se muestran como —", () => {
    expect(fmt2(1.234)).toBe("1.23")
    expect(fmt2(null)).toBe("—")
    expect(fmtPct(66.6)).toBe("67%")
    expect(fmtPct(null)).toBe("—")
  })

  it("sigla del equipo, o las iniciales si no tiene", () => {
    expect(teamTag({ tag: "GTK", name: "GO TO KNOW" })).toBe("GTK")
    expect(teamTag({ tag: "", name: "los extraditables" })).toBe("LE")
    expect(teamTag({ tag: null, name: "New Team Five Sur" })).toBe("NTF")
  })

  it("tendencia de equipos contra hace 30 días", () => {
    expect(teamTrend(2, 3)).toEqual({
      text: "▲2",
      tone: "up",
      title: "Hace 30 días: 5.º",
    })
    expect(teamTrend(-1, 4).text).toBe("▼1")
    expect(teamTrend(0, 1)).toMatchObject({ text: "–", tone: "flat" })
    expect(teamTrend(null, 1).title).toBe("Sin partidas hace 30 días")
  })

  it("cuenta regresiva en días, horas y minutos; null si ya pasó", () => {
    const now = Date.parse("2026-10-24T09:00:00Z")
    expect(countdown("2026-10-26T12:30:00Z", now)).toEqual({
      d: 2,
      h: 3,
      m: 30,
    })
    expect(countdown("2026-10-24T08:00:00Z", now)).toBeNull()
  })

  it("barras y ganador del comparador", () => {
    expect(barPct(50, 100)).toBe(50)
    expect(barPct(100, 50)).toBe(100)
    expect(barPct(null, 10)).toBe(0)
    expect(compareWinner(2, 2)).toBe("a")
    expect(compareWinner(1, 2)).toBe("b")
    expect(compareWinner(null, 2)).toBeNull()
  })
})

describe("search", () => {
  it("valores inválidos vuelven al de por defecto", () => {
    expect(
      playerRankingSearchSchema.parse({ level: "5", per: 30, page: 0 })
    ).toEqual({})
    expect(teamRankingSearchSchema.parse({ pcw: "si" })).toEqual({})
    expect(compareSearchSchema.parse({ a: "Zeta" })).toEqual({ a: "Zeta" })
  })

  it("Histórico: por posición salvo que se ordene por una columna", () => {
    expect(toPlayerRankingQuery({})).toEqual({ page: 1, per: 25 })
    expect(
      toPlayerRankingQuery({ q: " zeta ", level: "7-9", sort: "kd", page: 2 })
    ).toEqual({
      page: 2,
      per: 25,
      q: "zeta",
      level: "7-9",
      sort: "kd",
      order: "desc",
    })
    expect(toPlayerRankingQuery({ sort: "elo" })).toEqual({ page: 1, per: 25 })
  })

  it("temporada: eligible y orden por ELO o mixes", () => {
    expect(toStandingsQuery({ eligible: true })).toEqual({
      page: 1,
      per: 25,
      eligible: "true",
    })
    expect(toStandingsQuery({ sort: "matches", order: "asc" })).toMatchObject({
      sort: "matches",
      order: "asc",
    })
    // Rating no existe en la tabla de una temporada.
    expect(toStandingsQuery({ sort: "rating" })).toEqual({ page: 1, per: 25 })
  })

  it("equipos: pcw siempre explícito", () => {
    expect(toTeamRankingQuery({})).toEqual({ page: 1, per: 25, pcw: "0" })
    expect(toTeamRankingQuery({ pcw: true, per: 50 })).toEqual({
      page: 1,
      per: 50,
      pcw: "1",
    })
  })
})
