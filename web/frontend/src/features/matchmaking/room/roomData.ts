import type { RoomPlayer } from "@/features/mixes/room"
import type { MmClip, MmLobby, MmPlayer, MmRecent } from "../types"

// Cálculos de la sala de la partida (plan, sección 7, "Sala de la partida"). Solo con lo que trae
// la sala: nada de Swing, KAST ni duelos (decisión "Datos que la sala no muestra").

export type Team = 1 | 2

export const otherTeam = (t: Team): Team => (t === 1 ? 2 : 1)

export function teamPlayers(lobby: MmLobby, team: Team) {
  return lobby.players
    .filter((p) => p.team === team)
    .sort((a, b) => b.elo - a.elo)
}

/** "team_<capitán>", como en el veto; sin capitán todavía, "Equipo A/B". */
export function teamLabel(lobby: MmLobby, team: Team) {
  const captain = lobby.players.find((p) => p.team === team && p.is_captain)
  return captain ? `team_${captain.nick}` : team === 1 ? "Equipo A" : "Equipo B"
}

export function teamCaptain(lobby: MmLobby, team: Team): MmPlayer | undefined {
  return (
    lobby.players.find((p) => p.team === team && p.is_captain) ??
    teamPlayers(lobby, team)[0]
  )
}

export const avgElo = (players: MmPlayer[]) =>
  players.length
    ? Math.round(players.reduce((s, p) => s + p.elo, 0) / players.length)
    : 0

/** Nivel de un promedio de ELO, con los mismos pisos que el perfil. */
export function levelOf(elo: number, floors: readonly number[]) {
  let level = 1
  floors.forEach((f, i) => {
    if (elo >= f) level = i + 1
  })
  return level
}

/** Promedio del equipo en las últimas 30 partidas de cada uno (la línea de la cabecera). */
export function teamRecent(players: MmPlayer[]): MmRecent | null {
  const rs = players.map((p) => p.recent).filter((r): r is MmRecent => !!r)
  if (!rs.length) return null
  const avg = (f: (r: MmRecent) => number, digits = 2) => {
    const v = rs.reduce((s, r) => s + f(r), 0) / rs.length
    const m = 10 ** digits
    return Math.round(v * m) / m
  }
  return {
    matches: rs.reduce((s, r) => s + r.matches, 0),
    win_pct: avg((r) => r.win_pct, 0),
    rating: avg((r) => r.rating),
    k: avg((r) => r.k, 0),
    d: avg((r) => r.d, 0),
    a: avg((r) => r.a, 0),
    kd: avg((r) => r.kd),
    kr: avg((r) => r.kr),
    adr: avg((r) => r.adr, 1),
  }
}

/** MVP de la partida: el que trae la marca; si no hay (en vivo), el de mejor rating. */
export function mvpOf(stats: RoomPlayer[]): RoomPlayer | null {
  return (
    stats.find((s) => s.mvp) ??
    [...stats].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ??
    null
  )
}

export type Leader = { label: string; value: string; player: RoomPlayer }

/** Más kills, más daño, más primeras kills y más clutches (este, solo terminada). */
export function leadersOf(stats: RoomPlayer[]): Leader[] {
  const top = (f: (p: RoomPlayer) => number) =>
    [...stats].sort((a, b) => f(b) - f(a))[0]
  if (!stats.length) return []
  const damage = (p: RoomPlayer) => Math.round((p.adr ?? 0) * p.rounds)
  const clutches = (p: RoomPlayer) =>
    (p.clutches ?? []).reduce((s, n) => s + n, 0)
  const out: Leader[] = [
    {
      label: "Más kills",
      value: String(top((p) => p.k)!.k),
      player: top((p) => p.k)!,
    },
    {
      label: "Más daño",
      value: String(damage(top(damage)!)),
      player: top(damage)!,
    },
    {
      label: "Primeras kills",
      value: String(top((p) => p.fk)!.fk),
      player: top((p) => p.fk)!,
    },
  ]
  if (stats.some((p) => p.clutches)) {
    const c = top(clutches)!
    if (clutches(c) > 0)
      out.push({ label: "Clutches", value: String(clutches(c)), player: c })
  }
  return out
}

/** "Dust2 · 4K", "Dust2 · Clutch 1v3" (con el nombre visible del mapa). */
export function clipTitle(clip: MmClip, mapName: string | null) {
  const what = clip.type.startsWith("clutch_")
    ? `Clutch 1v${clip.type.slice(7)}`
    : clip.type === "ace"
      ? "Ace"
      : clip.type.toUpperCase()
  return mapName ? `${mapName} · ${what}` : what
}
