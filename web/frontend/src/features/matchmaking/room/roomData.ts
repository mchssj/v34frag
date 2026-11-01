import type { RoomPlayer, RoomSide } from "@/features/mixes/room"
import type {
  MmClip,
  MmLobby,
  MmMatch,
  MmPlayer,
  MmRecent,
  MmVeto,
} from "../types"

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

/** Un bando con el modelo de la sala de Mixes, para usar sus mismas tablas. */
export function roomSide(lobby: MmLobby, match: MmMatch, team: Team): RoomSide {
  const ids = new Set(teamPlayers(lobby, team).map((p) => p.player_id))
  return {
    name: teamLabel(lobby, team),
    score: team === 1 ? match.score1 : match.score2,
    result:
      match.winner === null
        ? "playing"
        : match.winner === team
          ? "win"
          : "loss",
    players: match.stats
      .filter((s) => ids.has(s.key))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
  }
}

/** Probabilidad (0 a 100) de que gane el equipo A según el ELO promedio, con la fórmula de Elo. */
export function winChance(a: number, b: number) {
  return Math.round(100 / (1 + 10 ** ((b - a) / 400)))
}

/** El mapa que más le conviene banear a un equipo: donde más le saca ventaja el rival. */
export function suggestBan(veto: MmVeto, team: Team) {
  const banned = new Set(veto.bans.map((b) => b.map))
  let best: { label: string; mine: number; theirs: number } | null = null
  for (const m of veto.pool) {
    if (banned.has(m.name)) continue
    const a = m.team1_win_pct
    const b = m.team2_win_pct
    if (a === null || b === null) continue
    const [mine, theirs] = team === 1 ? [a, b] : [b, a]
    if (!best || theirs - mine > best.theirs - best.mine)
      best = { label: m.label, mine, theirs }
  }
  // Con menos de 5 puntos de diferencia no es una ventaja real.
  return best && best.theirs - best.mine >= 5 ? best : null
}

/** Tu partida contra tu promedio de las últimas 30, en % de diferencia. */
export function comparedToAverage(stat: RoomPlayer, recent: MmRecent | null) {
  if (!recent) return []
  const diff = (now: number | null, avg: number) =>
    now === null || avg === 0 ? null : Math.round(((now - avg) / avg) * 100)
  const items = [
    { label: "Rating", diff: diff(stat.rating, recent.rating) },
    { label: "ADR", diff: diff(stat.adr, recent.adr) },
    { label: "K/D", diff: diff(stat.d ? stat.k / stat.d : null, recent.kd) },
  ]
  return items.filter(
    (i): i is { label: string; diff: number } => i.diff !== null
  )
}
