import { PLAYERS, type SearchPlayer } from "@/features/search/demo"

// Jugadores de ejemplo para /demo/comparador: los del buscador más lo que pide el comparador (ADR,
// victorias, ELO máximo y los últimos 30 mixes de ELO). Todo sale de una semilla por jugador.

export interface ComparePlayer extends SearchPlayer {
  adr: number
  winrate: number
  peak_elo: number
  /** ELO después de cada uno de los últimos 30 mixes, del más viejo al más nuevo. */
  history: number[]
}

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function extend(p: SearchPlayer, i: number): ComparePlayer {
  const r = seeded(1000 + i)
  // La serie termina en el ELO actual: se arma hacia atrás.
  const back = [p.elo]
  for (let k = 1; k < 30; k++)
    back.push(Math.max(100, back[k - 1]! - Math.round((r() - 0.45) * 55)))
  const history = back.reverse()
  return {
    ...p,
    adr: +(55 + p.rating * 25 + r() * 12).toFixed(1),
    winrate: +Math.min(
      80,
      Math.max(25, 50 + (p.kd - 1) * 30 + (r() - 0.5) * 14)
    ).toFixed(1),
    peak_elo: Math.max(...history) + Math.round(r() * 40),
    history,
  }
}

export const COMPARE_PLAYERS = PLAYERS.slice(0, 80).map(extend)
export const byNick = (nick: string) =>
  COMPARE_PLAYERS.find((p) => p.nick.toLowerCase() === nick.toLowerCase())

/** Mixes juntos y como rivales de dos jugadores (lo que devuelve `together` en la API), con semilla por par. */
export function together(a: string, b: string) {
  let h = 0
  for (const ch of [a, b].sort().join("|")) h = (h * 31 + ch.charCodeAt(0)) | 0
  const r = seeded(h)
  const same = 3 + Math.floor(r() * 12)
  const against = 5 + Math.floor(r() * 25)
  return {
    same_team: { matches: same, wins: Math.floor(same * (0.3 + r() * 0.5)) },
    against: {
      matches: against,
      a_wins: Math.floor(against * (0.3 + r() * 0.4)),
    },
  }
}
