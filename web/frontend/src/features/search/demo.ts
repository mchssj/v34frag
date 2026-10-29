import { levelOf } from "@/features/matchmaking/room/roomData"
import { LEVEL_FLOORS } from "@/features/player/labels"

// Jugadores y mixes de ejemplo para /demo/buscador (docs/bitacora/2026-10-29-buscador-avanzado en
// kyan/pruebas). Se generan con una semilla fija: cada vez que se abre la página salen los mismos.

export const DEMO_MAPS = [
  "de_dust2",
  "de_inferno",
  "de_tuscan",
  "de_nuke",
  "de_train",
  "de_cbble",
  "de_mirage",
] as const
export const DEMO_COUNTRIES = [
  "Argentina",
  "Uruguay",
  "Chile",
  "Perú",
  "España",
  "México",
  "Brasil",
] as const
export type DemoCountry = (typeof DEMO_COUNTRIES)[number]
export type MatchKind = "mix" | "pcw" | "official"

export interface SearchPlayer {
  id: string
  nick: string
  team_tag: string | null
  country: DemoCountry
  elo: number
  level: number
  kd: number
  rating: number
  hs: number
  matches: number
  /** Días desde la última partida. */
  last_days: number
  fav_map: string
  vip: boolean
}

export interface SearchMatch {
  id: string
  /** Fecha AAAA-MM-DD. */
  date: string
  map: string
  kind: MatchKind
  score: [number, number]
  team_a: string[]
  team_b: string[]
  mvp: string
  mvp_rating: number
  has_demo: boolean
  cancelled: boolean
}

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rnd = seeded(34)
const int = (min: number, max: number) =>
  min + Math.floor(rnd() * (max - min + 1))
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!
// Normal aproximada (suma de tres uniformes) para que haya más jugadores en el medio de la tabla.
const bell = (mid: number, spread: number) =>
  mid + ((rnd() + rnd() + rnd()) / 3 - 0.5) * 2 * spread

const START = [
  "ka",
  "zo",
  "mi",
  "ru",
  "te",
  "lo",
  "ni",
  "fa",
  "gu",
  "pe",
  "ro",
  "xi",
  "da",
  "ju",
  "ki",
  "ma",
]
const END = [
  "no",
  "lo",
  "ta",
  "x",
  "ni",
  "ko",
  "zz",
  "on",
  "ito",
  "rd",
  "nk",
  "o",
  "ry",
  "ez",
]
const DECOR = ["", "", "", "_", ".", "1", "99", "x", "ok", "cs"]
const TEAMS = [
  "v34",
  "RBK",
  "TNT",
  "LOB",
  "MNK",
  "SKR",
  "AAA",
  null,
  null,
  null,
] as const

function nickFor(i: number) {
  return (
    (pick(START) + pick(END) + pick(DECOR)).slice(0, 12) +
    (i % 7 === 0 ? String(i % 10) : "")
  )
}

const TODAY = new Date("2026-10-29T12:00:00")
const iso = (daysAgo: number) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function makePlayers(n: number): SearchPlayer[] {
  const seen = new Set<string>()
  const out: SearchPlayer[] = []
  for (let i = 0; out.length < n; i++) {
    const nick = nickFor(i)
    if (seen.has(nick.toLowerCase())) continue
    seen.add(nick.toLowerCase())
    const elo = Math.round(Math.max(300, Math.min(2400, bell(1250, 1150))))
    // A más ELO, un poco mejor K/D y rating.
    const skill = (elo - 1250) / 1100
    out.push({
      id: `p${out.length}`,
      nick,
      team_tag: pick(TEAMS),
      country: rnd() < 0.55 ? "Argentina" : pick(DEMO_COUNTRIES),
      elo,
      level: levelOf(elo, LEVEL_FLOORS),
      kd: +Math.max(0.4, bell(1 + skill * 0.35, 0.3)).toFixed(2),
      rating: +Math.max(0.5, bell(1 + skill * 0.25, 0.22)).toFixed(2),
      hs: +Math.max(20, Math.min(75, bell(45 + skill * 8, 15))).toFixed(1),
      matches: Math.round(Math.max(1, bell(70, 70))),
      last_days: rnd() < 0.5 ? int(0, 7) : int(8, 200),
      fav_map: pick(DEMO_MAPS),
      vip: rnd() < 0.12,
    })
  }
  return out
}

function makeMatches(players: SearchPlayer[], n: number): SearchMatch[] {
  return Array.from({ length: n }, (_, i) => {
    // La mayoría de los mixes los juegan los 40 habituales, como en el servidor real.
    const pool = rnd() < 0.85 ? players.slice(0, 40) : players
    const ten = [...pool].sort(() => rnd() - 0.5).slice(0, 10)
    // MR12: 13 a 0–11, o alargue 16 a 13–14.
    const [w, l] = rnd() < 0.12 ? [16, int(13, 14)] : [13, int(0, 11)]
    const score: [number, number] = rnd() < 0.5 ? [w, l] : [l, w]
    const kindRoll = rnd()
    return {
      id: `m${n - i}`,
      date: iso(Math.floor(i / 4)),
      map: pick(DEMO_MAPS),
      kind: kindRoll < 0.8 ? "mix" : kindRoll < 0.93 ? "pcw" : "official",
      score,
      team_a: ten.slice(0, 5).map((p) => p.nick),
      team_b: ten.slice(5).map((p) => p.nick),
      mvp: pick(ten).nick,
      mvp_rating: +bell(1.45, 0.4).toFixed(2),
      has_demo: rnd() < 0.7,
      cancelled: rnd() < 0.06,
    }
  })
}

export const PLAYERS = makePlayers(220)
export const MATCHES = makeMatches(PLAYERS, 420)
