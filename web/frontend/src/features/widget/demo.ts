import { useCallback, useState } from "react"

import type { WidgetPeriod } from "./options"
import type { PeriodStats, WidgetData, WidgetResult } from "./StreamWidget"

// Widget de ejemplo en memoria, sin API. Cada mix simulado mueve el ELO como un 5v5 parejo
// (±30 base, ±5 por rating) y suma a los cuatro períodos y a los últimos resultados, igual que
// widget_player(). Las stats son las del JSON del reporter 2.7.0 en adelante.

const stats = (s: Partial<PeriodStats>): PeriodStats => ({
  v: 0,
  d: 0,
  e: 0,
  elo: 0,
  kills: 0,
  deaths: 0,
  rounds: 0,
  damage: 0,
  headshots: 0,
  k3: 0,
  k4: 0,
  k5: 0,
  sniper: 0,
  knife: 0,
  clutches: 0,
  entries: 0,
  pistols: 0,
  rating: null,
  ...s,
})

const START_PERIODS: Record<WidgetPeriod, PeriodStats> = {
  hoy: stats({
    v: 3,
    d: 1,
    e: 1,
    elo: 41,
    kills: 84,
    deaths: 66,
    rounds: 108,
    damage: 9820,
    headshots: 47,
    k3: 4,
    k4: 1,
    k5: 0,
    sniper: 9,
    knife: 0,
    clutches: 1,
    entries: 13,
    pistols: 4,
    rating: 1.12,
  }),
  "24h": stats({
    v: 4,
    d: 2,
    e: 1,
    elo: 35,
    kills: 118,
    deaths: 97,
    rounds: 151,
    damage: 13650,
    headshots: 66,
    k3: 5,
    k4: 1,
    k5: 0,
    sniper: 12,
    knife: 0,
    clutches: 2,
    entries: 18,
    pistols: 5,
    rating: 1.08,
  }),
  temporada: stats({
    v: 29,
    d: 17,
    e: 2,
    elo: 187,
    kills: 912,
    deaths: 706,
    rounds: 1094,
    damage: 101300,
    headshots: 503,
    k3: 41,
    k4: 12,
    k5: 2,
    sniper: 88,
    knife: 3,
    clutches: 14,
    entries: 141,
    pistols: 33,
    rating: 1.15,
  }),
  historico: stats({
    v: 118,
    d: 87,
    e: 7,
    elo: 187,
    kills: 3810,
    deaths: 3155,
    rounds: 4790,
    damage: 418200,
    headshots: 2066,
    k3: 162,
    k4: 41,
    k5: 6,
    sniper: 361,
    knife: 11,
    clutches: 52,
    entries: 590,
    pistols: 127,
    rating: 1.07,
  }),
}

const START: Omit<WidgetData, "period"> = {
  nick: "Pepon",
  team_tag: "v34",
  country: "Argentina",
  elo: 1187,
  peak_elo: 1210,
  rank: 14,
  country_rank: 9,
  ultimos: [
    { r: "V", elo: 24 },
    { r: "V", elo: 19 },
    { r: "E", elo: 6 },
    { r: "D", elo: -27 },
    { r: "V", elo: 28 },
    { r: "D", elo: -31 },
    { r: "V", elo: 25 },
    { r: "V", elo: 22 },
    { r: "D", elo: -24 },
    { r: "V", elo: 30 },
  ],
}

const rand = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1))

export function useWidgetDemo() {
  const [base, setBase] = useState(START)
  const [periods, setPeriods] = useState(START_PERIODS)

  const dataFor = useCallback(
    (p: WidgetPeriod): WidgetData => ({ ...base, period: periods[p] }),
    [base, periods]
  )

  const playMix = useCallback((r: WidgetResult) => {
    const delta =
      r === "V" ? rand(25, 35) : r === "D" ? -rand(25, 35) : rand(-5, 5)
    const rounds = rand(18, 26)
    const kills = rand(12, 28)
    const add: Partial<PeriodStats> = {
      v: r === "V" ? 1 : 0,
      d: r === "D" ? 1 : 0,
      e: r === "E" ? 1 : 0,
      elo: delta,
      kills,
      deaths: rand(12, 24),
      rounds,
      damage: kills * rand(95, 125),
      headshots: Math.round(kills * (0.4 + Math.random() * 0.2)),
      k3: rand(0, 2),
      k4: Math.random() < 0.3 ? 1 : 0,
      k5: Math.random() < 0.08 ? 1 : 0,
      sniper: rand(0, 5),
      knife: Math.random() < 0.05 ? 1 : 0,
      clutches: Math.random() < 0.3 ? 1 : 0,
      entries: rand(1, 6),
      pistols: rand(0, 2),
    }
    setPeriods((ps) => {
      const next = { ...ps }
      for (const k of Object.keys(ps) as WidgetPeriod[]) {
        const s = { ...ps[k] }
        for (const [f, n] of Object.entries(add) as [
          keyof PeriodStats,
          number,
        ][])
          (s as unknown as Record<string, number>)[f] =
            ((s[f] as number) ?? 0) + n
        next[k] = s
      }
      return next
    })
    setBase((b) => {
      const elo = Math.max(100, b.elo + delta)
      return {
        ...b,
        elo,
        peak_elo: Math.max(b.peak_elo, elo),
        ultimos: [{ r, elo: delta }, ...b.ultimos].slice(0, 10),
      }
    })
    return delta
  }, [])

  const newDay = useCallback(() => {
    setPeriods((ps) => ({ ...ps, hoy: stats({}) }))
  }, [])
  const setElo = useCallback(
    (elo: number) =>
      setBase((b) => ({ ...b, elo, peak_elo: Math.max(b.peak_elo, elo) })),
    []
  )
  const setRank = useCallback(
    (rank: number) =>
      setBase((b) => ({
        ...b,
        rank,
        country_rank: Math.min(b.country_rank ?? rank, rank),
      })),
    []
  )
  const reset = useCallback(() => {
    setBase(START)
    setPeriods(START_PERIODS)
  }, [])

  return { dataFor, playMix, newDay, setElo, setRank, reset }
}
