// Stats de ejemplo para /demo/exportar (docs/bitacora/2026-10-29-exportar-stats en kyan/pruebas). La
// forma es la de una ruta que todavía no existe: stats agregadas de un jugador por período.

export type ExportPeriod = "season" | "30d" | "all"

export interface ExportStats {
  nick: string
  team_tag: string | null
  country: string
  elo: number
  peak_elo: number
  matches: number
  wins: number
  kd: number
  rating: number
  hs: number
  adr: number
  mvp: number
  streak: number
  maps: { name: string; matches: number; winrate: number }[]
  /** ELO después de cada mix del período, del más viejo al más nuevo. */
  elo_history: number[]
}

export const PERIOD_LABEL: Record<ExportPeriod, string> = {
  season: "Temporada 3",
  "30d": "Últimos 30 días",
  all: "Histórico",
}

// Generador con semilla (mulberry32): la misma serie cada vez que se abre la página.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function history(seed: number, n: number, start: number, drift: number) {
  const r = seeded(seed)
  const out = [start]
  for (let i = 1; i < n; i++)
    out.push(Math.max(100, out[i - 1]! + Math.round((r() - 0.5 + drift) * 60)))
  return out
}

function stats(
  seed: number,
  n: number,
  start: number,
  drift: number,
  rest: Omit<
    ExportStats,
    | "nick"
    | "team_tag"
    | "country"
    | "elo"
    | "peak_elo"
    | "matches"
    | "elo_history"
  >
): ExportStats {
  const elo_history = history(seed, n, start, drift)
  return {
    nick: "Pepon",
    team_tag: "v34",
    country: "AR",
    elo: elo_history.at(-1)!,
    peak_elo: Math.max(...elo_history),
    matches: n,
    elo_history,
    ...rest,
  }
}

export const DEMO_STATS: Record<ExportPeriod, ExportStats> = {
  season: stats(7, 48, 1320, 0.12, {
    wins: 29,
    kd: 1.24,
    rating: 1.13,
    hs: 52.4,
    adr: 88.1,
    mvp: 11,
    streak: 5,
    maps: [
      { name: "de_dust2", matches: 17, winrate: 64.7 },
      { name: "de_inferno", matches: 12, winrate: 58.3 },
      { name: "de_tuscan", matches: 9, winrate: 66.7 },
    ],
  }),
  "30d": stats(11, 19, 1480, 0.1, {
    wins: 12,
    kd: 1.31,
    rating: 1.18,
    hs: 54.9,
    adr: 91.6,
    mvp: 5,
    streak: 5,
    maps: [
      { name: "de_inferno", matches: 7, winrate: 71.4 },
      { name: "de_dust2", matches: 6, winrate: 50 },
      { name: "de_nuke", matches: 3, winrate: 66.7 },
    ],
  }),
  all: stats(3, 212, 1000, 0.06, {
    wins: 118,
    kd: 1.09,
    rating: 1.04,
    hs: 49.8,
    adr: 81.3,
    mvp: 37,
    streak: 8,
    maps: [
      { name: "de_dust2", matches: 74, winrate: 57.1 },
      { name: "de_inferno", matches: 51, winrate: 54.9 },
      { name: "de_train", matches: 30, winrate: 50 },
    ],
  }),
}
