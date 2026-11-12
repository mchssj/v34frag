// Datos de ejemplo de la demo de Administración › Medallas (/demo/admin-medallas). No son jugadores reales.

export type DemoSeason = { id: string; label: string; short: string } // short: lo que va en la medalla
export type DemoPlayer = {
  id: string
  alias: string
  steam: string
  elo: number
}
export type DemoGrant = {
  id: string
  medal: string // clave del catálogo
  title: string
  player: string // id del jugador
  season: string | null
  at: string
}

export const SEASONS: DemoSeason[] = [
  { id: "beta", label: "Temporada BETA", short: "BETA" },
  { id: "s1", label: "Temporada 1", short: "S1" },
  { id: "s2", label: "Temporada 2", short: "S2" },
]

const ALIASES = [
  "pepon",
  "mecha",
  "rulo",
  "tincho",
  "nacho",
  "fede",
  "lauti",
  "juanma",
  "santi",
  "gonza",
  "bruno",
  "chino",
  "colo",
  "facu",
  "mati",
  "nico",
  "rodri",
  "seba",
  "tomi",
  "uriel",
]

export const PLAYERS: DemoPlayer[] = ALIASES.map((alias, i) => ({
  id: `p${i + 1}`,
  alias,
  steam: `STEAM_0:${i % 2}:${4100200 + i * 37}`,
  elo: 1480 - i * 37 + (i % 3) * 12,
}))

export const GRANTS: DemoGrant[] = [
  {
    id: "g1",
    medal: "campeon_torneo",
    title: "Campeón de torneo",
    player: "p1",
    season: "beta",
    at: "2026-10-30",
  },
  {
    id: "g2",
    medal: "finalista_torneo",
    title: "Finalista de torneo",
    player: "p2",
    season: "beta",
    at: "2026-10-30",
  },
  {
    id: "g3",
    medal: "beta_tester",
    title: "Beta tester",
    player: "p3",
    season: null,
    at: "2026-10-28",
  },
  {
    id: "g4",
    medal: "beta_tester",
    title: "Beta tester",
    player: "p4",
    season: null,
    at: "2026-10-28",
  },
  {
    id: "g5",
    medal: "pionero_primer_mix",
    title: "Pionero: jugó el primer mix",
    player: "p1",
    season: null,
    at: "2026-10-21",
  },
  {
    id: "g6",
    medal: "mvp_temporada",
    title: "Mejor jugador de la temporada",
    player: "p1",
    season: "beta",
    at: "2026-11-01",
  },
]

/** Una línea por jugador: alias o SteamID, sin importar mayúsculas. */
export function matchPasted(text: string, players: DemoPlayer[]) {
  const found: DemoPlayer[] = []
  const missing: string[] = []
  for (const raw of text.split(/[\n,;]+/)) {
    const q = raw.trim().toLowerCase()
    if (!q) continue
    const p = players.find(
      (x) => x.alias.toLowerCase() === q || x.steam.toLowerCase() === q
    )
    if (p) found.push(p)
    else missing.push(raw.trim())
  }
  return { found, missing }
}
