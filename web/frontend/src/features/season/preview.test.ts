import { describe, expect, it } from "vitest"

import { previewFor, rankAll, resetElo, tierOf, type Standing } from "./preview"

const s = (
  id: string,
  elo: number,
  matches = 30,
  last_at = "2026-10-01"
): Standing => ({
  id,
  nick: id,
  elo,
  matches,
  last_at,
})

describe("cierre de temporada", () => {
  it("reinicia solo a los que pasan 2001, al 10 %", () => {
    expect(resetElo(1990)).toBe(1990)
    expect(resetElo(2001)).toBe(2001)
    expect(resetElo(2301)).toBe(2031)
    expect(resetElo(2006)).toBe(2002) // 0,5 se redondea hacia arriba (numeric)
  })

  it("tramos por puesto con el top 20", () => {
    expect(tierOf(1)?.name).toBe("Campeón")
    expect(tierOf(3)?.name).toBe("Tercer puesto")
    expect(tierOf(10)?.name).toBe("Top 10")
    expect(tierOf(20)?.name).toBe("Top 20")
    expect(tierOf(21)).toBeNull()
    expect(tierOf(null)).toBeNull()
  })

  it("sin el mínimo de mixes no hay puesto, y desempata por mixes", () => {
    const r = rankAll([s("a", 1500, 10), s("b", 1400, 25), s("c", 1400, 40)])
    expect(r.find((x) => x.id === "a")?.rank).toBeNull()
    expect(r.find((x) => x.id === "c")?.rank).toBe(1)
    expect(r.find((x) => x.id === "b")?.rank).toBe(2)
  })

  it("dice cuánto falta para el puesto y el tramo de arriba", () => {
    const list = Array.from({ length: 12 }, (_, i) =>
      s(`p${i + 1}`, 2000 - i * 10)
    )
    const p = previewFor("p11", list)
    expect(p.rank).toBe(11)
    expect(p.tier?.name).toBe("Top 20")
    expect(p.to_next_rank).toBe(11) // p10 tiene 1910, p11 1900
    expect(p.to_next_tier?.tier.name).toBe("Top 10")
    expect(p.to_next_tier?.elo).toBe(11)
    expect(p.lead_below).toBe(10)
  })
})
