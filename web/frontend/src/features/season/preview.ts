// Reglas del cierre de temporada (supabase/replanteo/24_temporadas.sql) para la vista previa del próximo
// recálculo (docs/bitacora/2026-10-29-proximo-recalculo en kyan/pruebas). Si cambian en la base, cambiar acá.

export interface Tier {
  from: number
  to: number | null
  name: string
  icon: string
}

export interface SeasonRules {
  top_n: number
  min_matches: number
  reset_pct: number
  reset_floor: number
  tiers: Tier[]
}

/** Valores por defecto de `season_config`. */
export const DEFAULT_RULES: SeasonRules = {
  top_n: 20,
  min_matches: 20,
  reset_pct: 10,
  reset_floor: 2001,
  tiers: [
    { from: 1, to: 1, name: "Campeón", icon: "🏆" },
    { from: 2, to: 2, name: "Subcampeón", icon: "🥈" },
    { from: 3, to: 3, name: "Tercer puesto", icon: "🥉" },
    { from: 4, to: 10, name: "Top 10", icon: "🎖️" },
    { from: 11, to: null, name: "Top {top}", icon: "🏅" },
  ],
}

export interface Standing {
  id: string
  nick: string
  elo: number
  matches: number
  /** Para desempatar: la última partida (ISO). */
  last_at: string
}

/** season_reset_elo: los que pasan el piso quedan en piso + redondeo((ELO − piso) × %). */
export function resetElo(elo: number, r: SeasonRules = DEFAULT_RULES) {
  if (elo <= r.reset_floor) return elo
  // round(numeric): los .5 se alejan del cero.
  return r.reset_floor + Math.round(((elo - r.reset_floor) * r.reset_pct) / 100)
}

/** season_tier: el tramo del puesto, si está dentro del top N. */
export function tierOf(
  rank: number | null,
  r: SeasonRules = DEFAULT_RULES
): Tier | null {
  if (rank === null || rank > r.top_n) return null
  const t = r.tiers.find((t) => rank >= t.from && rank <= (t.to ?? r.top_n))
  return t ? { ...t, name: t.name.replace("{top}", String(r.top_n)) } : null
}

/**
 * season_rank: puesto solo entre los que llegan al mínimo de mixes, por ELO, después más mixes, después
 * la última partida más vieja (llegó antes) y por último el id.
 */
export function rankAll(list: Standing[], r: SeasonRules = DEFAULT_RULES) {
  const eligible = list
    .filter((s) => s.matches >= r.min_matches)
    .sort(
      (a, b) =>
        b.elo - a.elo ||
        b.matches - a.matches ||
        a.last_at.localeCompare(b.last_at) ||
        a.id.localeCompare(b.id)
    )
  const rank = new Map(eligible.map((s, i) => [s.id, i + 1]))
  return list.map((s) => ({
    ...s,
    rank: rank.get(s.id) ?? null,
    eligible: rank.has(s.id),
  }))
}

export interface Preview {
  rank: number | null
  eligible: boolean
  missing: number
  tier: Tier | null
  elo: number
  elo_after: number
  /** ELO que falta para el puesto de arriba y para entrar al tramo siguiente (null si ya es el mejor). */
  to_next_rank: number | null
  to_next_tier: { tier: Tier; elo: number } | null
  /** Cuánto ELO te separa del que te puede sacar del puesto (null si sos el último). */
  lead_below: number | null
}

/** La vista previa de un jugador si la temporada cerrara con esta tabla. */
export function previewFor(
  id: string,
  list: Standing[],
  r: SeasonRules = DEFAULT_RULES
): Preview {
  const ranked = rankAll(list, r)
  const me = ranked.find((s) => s.id === id)!
  const byRank = ranked
    .filter((s) => s.rank !== null)
    .sort((a, b) => a.rank! - b.rank!)
  const tier = tierOf(me.rank, r)

  let to_next_rank: number | null = null
  let to_next_tier: Preview["to_next_tier"] = null
  let lead_below: number | null = null
  if (me.rank !== null) {
    const above = byRank[me.rank - 2]
    if (above) to_next_rank = above.elo - me.elo + 1
    const below = byRank[me.rank]
    if (below) lead_below = me.elo - below.elo
    // El tramo siguiente: el mejor tramo que todavía no tenés. Su último puesto marca el ELO a superar.
    const better = r.tiers
      .map((t) => ({ ...t, to: t.to ?? r.top_n }))
      .filter((t) => t.to < (me.rank! <= r.top_n ? tier!.from : r.top_n + 1))
      .at(-1)
    if (better) {
      const target = byRank[better.to - 1]
      if (target)
        to_next_tier = {
          tier: {
            ...better,
            name: better.name.replace("{top}", String(r.top_n)),
          },
          elo: target.elo - me.elo + 1,
        }
    }
  }

  return {
    rank: me.rank,
    eligible: me.eligible,
    missing: Math.max(0, r.min_matches - me.matches),
    tier,
    elo: me.elo,
    elo_after: resetElo(me.elo, r),
    to_next_rank,
    to_next_tier,
    lead_below,
  }
}
