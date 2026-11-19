import { useCallback, useMemo, useState } from "react"

import {
  FIRST_STEPS,
  isReady,
  MISSIONS,
  rewardOf,
  WEEK_BONUS,
  type Metric,
  type Mission,
} from "./catalog"
import { rotation, weekStart } from "./rotation"

// Progreso simulado para /demo/misiones (docs/bitacora/2026-10-29-misiones-semanales en kyan/pruebas). En
// la versión real el progreso lo suma la API con cada mix (las stats del plugin) y con cada evento de la web.
// Las semanales se reinician cada lunes; las de Primeros pasos cuentan desde que te registrás y no se reinician.

const MAPS = [
  "de_dust2",
  "de_inferno",
  "de_tuscan",
  "de_nuke",
  "de_train",
  "de_cbble",
]
const rand = (a: number, b: number) =>
  a + Math.floor(Math.random() * (b - a + 1))

/** Clave del progreso: la métrica, más el mapa o el arma cuando la misión los pide. */
export const progressKey = (m: Mission) =>
  m.metric === "map_mixes"
    ? `map_mixes:${m.map}`
    : m.metric === "weapon_kills"
      ? `weapon_kills:${m.weapon}`
      : m.metric

interface WeekState {
  progress: Record<string, number>
  maps: string[]
  streak: number
  claimed: string[]
  bonus: boolean
}
const EMPTY: WeekState = {
  progress: {},
  maps: [],
  streak: 0,
  claimed: [],
  bonus: false,
}

export interface PastWeek {
  week: number
  done: number
  total: number
  points: number
  coins: number
}

export function useMissionsDemo() {
  const [week, setWeek] = useState(0)
  const [vip, setVip] = useState(true)
  const [s, setS] = useState<WeekState>(EMPTY)
  // Primeros pasos: el progreso y lo reclamado de toda la cuenta.
  const [life, setLife] = useState<Record<string, number>>({})
  const [claimedOnce, setClaimedOnce] = useState<string[]>([])
  const [wallet, setWallet] = useState({ points: 420, coins: 60 })
  const [history, setHistory] = useState<PastWeek[]>([])

  const missions = useMemo(
    () => rotation(MISSIONS, week, week)[0]!.missions,
    [week]
  )
  const firstSteps = useMemo(() => FIRST_STEPS.filter((m) => isReady(m)), [])
  const valueOf = useCallback(
    (m: Mission) =>
      Math.min(m.target, (m.once ? life : s.progress)[progressKey(m)] ?? 0),
    [s, life]
  )
  const done = (m: Mission) => valueOf(m) >= m.target
  const isClaimed = (m: Mission) =>
    (m.once ? claimedOnce : s.claimed).includes(m.id)
  const normal = missions.filter((m) => !m.vip)
  const vipMissions = missions.filter((m) => m.vip)
  const claimable = [...missions, ...firstSteps].filter(
    (m) => done(m) && !isClaimed(m) && (vip || !m.vip)
  )
  const allNormalDone = normal.every(done)

  /** Un evento de la web: suma a Primeros pasos. */
  const add = (metric: Metric) =>
    setLife((l) => ({ ...l, [metric]: (l[metric] ?? 0) + 1 }))

  /** Un mix con stats al azar, como las que manda el plugin. Suma a las semanales. */
  const playMix = (won: boolean) => {
    const kills = rand(10, 30)
    const map = MAPS[rand(0, MAPS.length - 1)]!
    const rating = +(0.7 + Math.random() * 0.8).toFixed(2)
    setS((x) => {
      const p = { ...x.progress }
      const inc = (k: string, n: number) => (p[k] = (p[k] ?? 0) + n)
      inc("mixes_played", 1)
      if (won) inc("mixes_won", 1)
      inc("kills", kills)
      inc("headshots", Math.round(kills * (0.35 + Math.random() * 0.25)))
      inc("assists", rand(1, 7))
      inc("damage", kills * rand(95, 125))
      inc("first_kills", rand(0, 5))
      inc("triple_kills", rand(0, 2))
      if (Math.random() < 0.08) inc("aces", 1)
      inc("plants", rand(0, 3))
      inc("defuses", rand(0, 1))
      if (rating >= 1.2) inc("good_rating_mixes", 1)
      if (Math.random() < 0.9) inc("full_mixes", 1)
      inc(`map_mixes:${map}`, 1)
      const maps = x.maps.includes(map) ? x.maps : [...x.maps, map]
      p.maps_distinct = maps.length
      const streak = won ? x.streak + 1 : 0
      p.win_streak = Math.max(p.win_streak ?? 0, streak)
      return { ...x, progress: p, maps, streak }
    })
    return { map, kills, rating }
  }
  const playPcw = () =>
    setS((x) => ({
      ...x,
      progress: { ...x.progress, pcw_played: (x.progress.pcw_played ?? 0) + 1 },
    }))

  const claim = (m: Mission) => {
    if (!done(m) || isClaimed(m) || (m.vip && !vip)) return 0
    const r = rewardOf(m)
    if (m.once) setClaimedOnce((c) => [...c, m.id])
    else setS((x) => ({ ...x, claimed: [...x.claimed, m.id] }))
    setWallet((w) =>
      m.vip ? { ...w, coins: w.coins + r } : { ...w, points: w.points + r }
    )
    return r
  }
  const claimBonus = () => {
    if (!allNormalDone || s.bonus) return false
    setS((x) => ({ ...x, bonus: true }))
    setWallet((w) => ({ ...w, points: w.points + WEEK_BONUS }))
    return true
  }

  const nextWeek = () => {
    const shown = missions.filter((m) => vip || !m.vip)
    setHistory((h) => [
      {
        week,
        done: shown.filter(done).length,
        total: shown.length,
        points:
          normal
            .filter((m) => s.claimed.includes(m.id))
            .reduce((t, m) => t + rewardOf(m), 0) + (s.bonus ? WEEK_BONUS : 0),
        coins: vipMissions
          .filter((m) => s.claimed.includes(m.id))
          .reduce((t, m) => t + rewardOf(m), 0),
      },
      ...h,
    ])
    setWeek((w) => w + 1)
    // Solo se reinician las semanales.
    setS(EMPTY)
  }

  const reset = () => {
    setWeek(0)
    setS(EMPTY)
    setLife({})
    setClaimedOnce([])
    setHistory([])
    setWallet({ points: 420, coins: 60 })
  }

  return {
    week,
    /** "Ahora" de la demo: el jueves de la semana simulada, a las 20:00. */
    now: weekStart(week) + 3 * 86_400_000 + 14 * 3_600_000,
    vip,
    setVip,
    missions,
    normal,
    vipMissions,
    firstSteps,
    valueOf,
    done,
    isClaimed,
    bonusClaimed: s.bonus,
    allNormalDone,
    claimable,
    wallet,
    history,
    add,
    playMix,
    playPcw,
    claim,
    claimBonus,
    nextWeek,
    reset,
  }
}
export type MissionsDemo = ReturnType<typeof useMissionsDemo>
