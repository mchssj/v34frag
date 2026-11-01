// Stats de ejemplo para /demo/exportar (docs/bitacora/2026-10-29-exportar-stats en kyan/pruebas). La
// forma es la de una ruta que todavía no existe: stats agregadas de un jugador por período.

export type ExportPeriod = "season" | "30d" | "all"

export interface ExportStats {
  nick: string
  team_tag: string | null
  country: string
  /** Foto de perfil (`avatar_url` de la API). `null` si no subió ninguna. */
  avatar_url: string | null
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

// Foto de ejemplo: un dibujo en SVG, para no depender de una imagen de afuera.
const DEMO_AVATAR =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1e1b4b"/></linearGradient></defs>
<rect width="256" height="256" fill="url(#g)"/>
<circle cx="128" cy="104" r="50" fill="#f1c7a3"/>
<path d="M76 98c0-34 24-52 52-52s52 18 52 52c-8-14-26-20-52-20s-44 6-52 20z" fill="#2b1a10"/>
<rect x="82" y="92" width="92" height="22" rx="11" fill="#111"/>
<rect x="92" y="96" width="30" height="14" rx="7" fill="#ff6900"/><rect x="134" y="96" width="30" height="14" rx="7" fill="#ff6900"/>
<path d="M40 256c6-58 44-90 88-90s82 32 88 90z" fill="#ff6900"/>
<path d="M104 170l24 30 24-30" fill="none" stroke="#0a0a0a" stroke-width="8"/>
</svg>`
  )

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
    | "avatar_url"
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
    avatar_url: DEMO_AVATAR,
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
