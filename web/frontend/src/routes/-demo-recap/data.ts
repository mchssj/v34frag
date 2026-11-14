// Datos de ejemplo del recap (plan docs/bitacora/2026-11-14-recap-temporada). Inventados, solo para la demo.
// La forma es la que propone el plan para `season_recaps.data`, más lo que se sumó en el prototipo:
// promedios y percentiles de la temporada, arma favorita, mapas, temporada anterior y datos de cada persona.

import type { Schemas } from "@/api/client"
import { LEVEL_FLOORS } from "@/features/player/lib/labels"

export type EloPoint = Schemas["EloPoint"]

/** Lo que muestra el globo de una persona: su temporada en pocas cifras. */
export type RecapPlayer = {
  nick: string
  photo: string | null
  level: number
  elo: number
  kd: number
  matches: number
}

/** Cifras con promedio de la temporada (todos los que jugaron) y percentil. */
export type StatKey =
  | "matches"
  | "rounds"
  | "hours"
  | "win_pct"
  | "best_streak"
  | "kills"
  | "deaths"
  | "assists"
  | "kd"
  | "hs_pct"
  | "adr"
  | "mvps"
  | "first_kills"
  | "k4"
  | "aces"
  | "elo_delta"
  | "rating"

/** `pct`: porcentaje de jugadores que superaste (en muertes, que tuvieron más que vos). */
export type Compare = Record<StatKey, { avg: number; pct: number }>

export type SeasonRecap = {
  season: { number: number; name: string; starts_at: string; closed_at: string; players: number }
  player: RecapPlayer
  mixes: { matches: number; rounds: number; hours: number; busiest_day: { date: string; matches: number } }
  record: { wins: number; losses: number; best_streak: number }
  elo: { start: number; end: number; peak: number; points: EloPoint[] }
  numbers: {
    kills: number
    deaths: number
    assists: number
    hs_pct: number
    adr: number
    mvps: number
    aces: number
    k4: number
    first_kills: number
    rating: number
  }
  weapon: { name: string; kills: number; hs_pct: number; share_pct: number } | null
  maps: { name: string; matches: number; wins: number; kd: number }[]
  best_match: {
    id: string
    map: string
    date: string
    score: [number, number]
    won: boolean
    kills: number
    deaths: number
    adr: number
    rating: number
  }
  mates: {
    most_played: RecapPlayer & { together: number; won: number }
    most_wins: RecapPlayer & { together: number; won: number }
  }
  rivals: {
    victim: (RecapPlayer & { you_killed: number; killed_you: number }) | null
    nemesis: (RecapPlayer & { you_killed: number; killed_you: number }) | null
  }
  /** Tus 3 mejores jugadas de la temporada (ace > 4K > clutch más difícil > 3K, después las más vistas). */
  clips: RecapClip[]
  compare: Compare
  prev: { name: string; kd: number; adr: number; hs_pct: number; win_pct: number; rank: number | null } | null
  final: {
    rank: number | null
    eligible: boolean
    total_ranked: number
    level: number
    medal: { name: string; template: string } | null
  }
}

export type RecapClip = {
  id: string
  /** `ace`, `4k`, `3k` o `clutch_N`, como en los clips de las partidas. */
  type: string
  map: string
  round: number
  date: string
  seconds: number
  views: number
  match_id: string
}

export const levelOf =(elo: number) => LEVEL_FLOORS.filter((f) => elo >= f).length

const MAP_ROTATION = ["de_dust2", "de_inferno", "de_mirage_rc1", "de_dust2", "de_nuke", "de_train", "de_dust2"]

// Un punto por mix, repartidos en la temporada. El pico y el final salen de la curva.
function elo(from: number, steps: number[], startDay: string, days: number) {
  const t0 = new Date(`${startDay}T20:00:00Z`).getTime()
  let cur = from
  const points: EloPoint[] = steps.map((d, k) => {
    const before = cur
    cur += d
    return {
      match_id: `demo-${k}`,
      map: MAP_ROTATION[k % MAP_ROTATION.length],
      at: new Date(t0 + (k / steps.length) * days * 86_400_000).toISOString(),
      elo_before: before,
      elo_after: cur,
      elo_delta: d,
    }
  })
  return { start: from, end: cur, peak: Math.max(from, ...points.map((p) => p.elo_after)), points }
}

const TOP_ELO = elo(
  2010,
  [
    18, 21, -17, 19, 22, 20, -18, -19, 23, 17, 21, 19, 22, 24, -16, 18, -20, -21, 19, 23, 20, -17, 18, 21, -19, 22,
    20, 18, -21, -18, 19, 24, 21, -17, 18, -22, 20, 19, -18, 23, -20, 17, -19, 21, 18, -15, -10,
  ],
  "2026-10-01",
  30
)

const person = (nick: string, elo: number, kd: number, matches: number): RecapPlayer => ({
  nick,
  photo: null,
  elo,
  level: levelOf(elo),
  kd,
  matches,
})

export const RECAP_TOP: SeasonRecap = {
  season: { number: 3, name: "Temporada 3", starts_at: "2026-10-01", closed_at: "2026-10-31", players: 214 },
  player: person("Probador", TOP_ELO.end, 1.29, 47),
  mixes: { matches: 47, rounds: 1121, hours: 38, busiest_day: { date: "2026-10-18", matches: 6 } },
  record: { wins: 29, losses: 18, best_streak: 7 },
  elo: TOP_ELO,
  numbers: {
    kills: 1032,
    deaths: 801,
    assists: 214,
    hs_pct: 54,
    adr: 88.4,
    mvps: 96,
    aces: 3,
    k4: 11,
    first_kills: 142,
    rating: 1.21,
  },
  weapon: { name: "ak47", kills: 488, hs_pct: 61, share_pct: 47 },
  maps: [
    { name: "de_dust2", matches: 15, wins: 9, kd: 1.31 },
    { name: "de_inferno", matches: 9, wins: 7, kd: 1.44 },
    { name: "de_mirage_rc1", matches: 8, wins: 5, kd: 1.22 },
    { name: "de_nuke", matches: 7, wins: 3, kd: 1.05 },
    { name: "de_train", matches: 6, wins: 4, kd: 1.27 },
    { name: "de_tuscan_ob", matches: 2, wins: 1, kd: 1.12 },
  ],
  best_match: {
    id: "demo",
    map: "de_mirage_rc1",
    date: "2026-10-22",
    score: [16, 9],
    won: true,
    kills: 34,
    deaths: 14,
    adr: 131.2,
    rating: 1.92,
  },
  mates: {
    most_played: { ...person("nacho.v", 2144, 1.12, 39), together: 21, won: 13 },
    most_wins: { ...person("pibe_awp", 1980, 1.18, 31), together: 16, won: 13 },
  },
  rivals: {
    victim: { ...person("Zeta", 1622, 0.88, 41), you_killed: 58, killed_you: 23 },
    nemesis: { ...person("Lucho77", 2471, 1.46, 52), you_killed: 29, killed_you: 41 },
  },
  clips: [
    { id: "c1", type: "ace", map: "de_inferno", round: 14, date: "2026-10-12", seconds: 21, views: 342, match_id: "demo" },
    { id: "c2", type: "clutch_4", map: "de_dust2", round: 27, date: "2026-10-18", seconds: 34, views: 198, match_id: "demo" },
    { id: "c3", type: "4k", map: "de_mirage_rc1", round: 8, date: "2026-10-22", seconds: 17, views: 121, match_id: "demo" },
  ],
  compare: {
    matches: { avg: 18.4, pct: 91 },
    rounds: { avg: 431, pct: 91 },
    hours: { avg: 14.2, pct: 90 },
    win_pct: { avg: 50, pct: 84 },
    best_streak: { avg: 3.1, pct: 88 },
    kills: { avg: 352, pct: 93 },
    deaths: { avg: 338, pct: 9 },
    assists: { avg: 79, pct: 90 },
    kd: { avg: 0.98, pct: 87 },
    hs_pct: { avg: 44, pct: 82 },
    adr: { avg: 71.3, pct: 89 },
    mvps: { avg: 31, pct: 92 },
    first_kills: { avg: 46, pct: 94 },
    k4: { avg: 3.2, pct: 90 },
    aces: { avg: 0.4, pct: 96 },
    elo_delta: { avg: 12, pct: 89 },
    rating: { avg: 0.97, pct: 88 },
  },
  prev: { name: "Temporada 2", kd: 1.14, adr: 81.0, hs_pct: 49, win_pct: 55, rank: 11 },
  final: {
    rank: 4,
    eligible: true,
    total_ranked: 86,
    level: levelOf(TOP_ELO.end),
    medal: { name: "Top 10", template: "top_temporada" },
  },
}

const CASUAL_ELO = elo(1000, [21, 20, -19, -22, -20, 19, -21, -20], "2026-10-04", 26)

// Alguien que jugó poco: no llegó al mínimo, no tiene kills con posición (sin rivales ni arma) ni temporada anterior.
export const RECAP_CASUAL: SeasonRecap = {
  ...RECAP_TOP,
  player: person("Novato", CASUAL_ELO.end, 0.87, 8),
  mixes: { matches: 8, rounds: 187, hours: 6, busiest_day: { date: "2026-10-25", matches: 3 } },
  record: { wins: 3, losses: 5, best_streak: 2 },
  elo: CASUAL_ELO,
  numbers: {
    kills: 121,
    deaths: 139,
    assists: 31,
    hs_pct: 38,
    adr: 66.1,
    mvps: 9,
    aces: 0,
    k4: 0,
    first_kills: 12,
    rating: 0.86,
  },
  weapon: null,
  maps: [
    { name: "de_dust2", matches: 4, wins: 2, kd: 0.95 },
    { name: "de_inferno", matches: 3, wins: 1, kd: 0.81 },
    { name: "de_nuke", matches: 1, wins: 0, kd: 0.7 },
  ],
  best_match: { ...RECAP_TOP.best_match, map: "de_dust2", score: [16, 12], kills: 24, deaths: 15, adr: 97.5, rating: 1.31 },
  mates: {
    most_played: { ...person("Zeta", 1622, 0.88, 41), together: 5, won: 2 },
    most_wins: { ...person("Zeta", 1622, 0.88, 41), together: 5, won: 2 },
  },
  rivals: { victim: null, nemesis: null },
  clips: [],
  compare: {
    ...RECAP_TOP.compare,
    matches: { avg: 18.4, pct: 31 },
    rounds: { avg: 431, pct: 30 },
    hours: { avg: 14.2, pct: 29 },
    win_pct: { avg: 50, pct: 22 },
    best_streak: { avg: 3.1, pct: 35 },
    kills: { avg: 352, pct: 28 },
    deaths: { avg: 338, pct: 72 },
    assists: { avg: 79, pct: 27 },
    kd: { avg: 0.98, pct: 33 },
    hs_pct: { avg: 44, pct: 30 },
    adr: { avg: 71.3, pct: 38 },
    mvps: { avg: 31, pct: 26 },
    first_kills: { avg: 46, pct: 24 },
    k4: { avg: 3.2, pct: 0 },
    aces: { avg: 0.4, pct: 0 },
    elo_delta: { avg: 12, pct: 34 },
    rating: { avg: 0.97, pct: 32 },
  },
  prev: null,
  final: { rank: null, eligible: false, total_ranked: 86, level: levelOf(CASUAL_ELO.end), medal: null },
}
