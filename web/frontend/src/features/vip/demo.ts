import { MATCHES, PLAYERS, type SearchPlayer } from "@/features/search/demo"

// Datos de ejemplo para los demos VIP de las partidas, los créditos y los torneos
// (docs/bitacora/2026-10-29-partidas-favoritas y siguientes en kyan/pruebas). Salen de los jugadores y mixes del
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
  /** Meses que lleva siendo VIP (para los créditos). */
  vip_months: number
}

const r = seeded(77)
/** Los jugadores del buscador ordenados por ELO. */
export const RANK_PLAYERS: RankPlayer[] = [...PLAYERS]
  .sort((a, b) => b.elo - a.elo)
  .map((p) => ({ ...p, vip_months: p.vip ? 1 + Math.floor(r() * 14) : 0 }))

export { MATCHES }
