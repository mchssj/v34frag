import { MATCHES, PLAYERS, type SearchPlayer } from "@/features/search/demo"

// Datos de ejemplo para los demos VIP del ranking, las partidas, los créditos y los torneos
// (docs/bitacora/2026-10-29-ranking-vip y siguientes en kyan/pruebas). Salen de los jugadores y mixes del
// buscador, más lo que cada demo necesita, con semilla fija.

export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface RankPlayer extends SearchPlayer {
  position: number
  /** Cuenta verificada: Steam vinculado y mail confirmado. */
  verified: boolean
  /** ELO ganado en el mes (para el Top VIP del mes). */
  month_gain: number
  month_matches: number
  trend: number[]
  /** Meses que lleva siendo VIP (para los créditos). */
  vip_months: number
}

const r = seeded(77)
export const RANK_PLAYERS: RankPlayer[] = [...PLAYERS]
  .sort((a, b) => b.elo - a.elo)
  .map((p, i) => {
    const trend = [p.elo]
    for (let k = 1; k < 12; k++)
      trend.push(trend[k - 1]! - Math.round((r() - 0.45) * 50))
    return {
      ...p,
      position: i + 1,
      verified: p.vip || r() < 0.35,
      month_gain: Math.round((r() - 0.3) * 260),
      month_matches: Math.floor(r() * 40),
      trend: trend.reverse(),
      vip_months: p.vip ? 1 + Math.floor(r() * 14) : 0,
    }
  })

export { MATCHES }
