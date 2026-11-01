import { useCallback, useState } from "react"

import type { WidgetData, WidgetResult } from "./StreamWidget"

// Widget de ejemplo en memoria, sin API. Cada mix simulado mueve el ELO como un 5v5 parejo
// (±30 base, ±5 por rating) y suma a "hoy" y a los últimos 5, igual que widget_player().

const START: WidgetData = {
  nick: "Pepon",
  team_tag: "v34",
  elo: 1187,
  peak_elo: 1210,
  matches: 23,
  kd: 1.12,
  rating: 1.07,
  hoy: { v: 3, d: 1, e: 1, elo: 41, kills: 84, deaths: 66 },
  ultimos: [
    { r: "V", elo: 24 },
    { r: "V", elo: 19 },
    { r: "E", elo: 6 },
    { r: "D", elo: -27 },
    { r: "V", elo: 28 },
  ],
}

const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

export function useWidgetDemo() {
  const [data, setData] = useState<WidgetData>(START)

  const playMix = useCallback((r: WidgetResult) => {
    const delta = r === "V" ? rand(25, 35) : r === "D" ? -rand(25, 35) : rand(-5, 5)
    const kills = rand(12, 28)
    const deaths = rand(12, 24)
    setData((d) => {
      const elo = Math.max(100, d.elo + delta)
      return {
        ...d,
        elo,
        peak_elo: Math.max(d.peak_elo, elo),
        matches: d.matches + 1,
        hoy: {
          v: d.hoy.v + (r === "V" ? 1 : 0),
          d: d.hoy.d + (r === "D" ? 1 : 0),
          e: d.hoy.e + (r === "E" ? 1 : 0),
          elo: d.hoy.elo + delta,
          kills: d.hoy.kills + kills,
          deaths: d.hoy.deaths + deaths,
        },
        ultimos: [{ r, elo: delta }, ...d.ultimos].slice(0, 5),
      }
    })
    return delta
  }, [])

  const newDay = useCallback(
    () => setData((d) => ({ ...d, hoy: { v: 0, d: 0, e: 0, elo: 0, kills: 0, deaths: 0 } })),
    []
  )
  const setElo = useCallback(
    (elo: number) => setData((d) => ({ ...d, elo, peak_elo: Math.max(d.peak_elo, elo) })),
    []
  )
  const reset = useCallback(() => setData(START), [])

  return { data, playMix, newDay, setElo, reset }
}
