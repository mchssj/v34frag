import { adr, hsPercent, nickOf } from "./labels"
import type { LiveMixDetail } from "./queries"

// Modelo común de la sala del mix: la terminada o cancelada sale de GET /matches/{id} y la en
// vivo de GET /mixes/live/{uid}. Los componentes solo conocen este modelo.

export type RoomStatus = "live" | "finished" | "cancelled"
export type SideResult = "win" | "loss" | "playing" | "cancelled" | "draw"

export type RoomPlayer = {
  key: string
  nick: string
  /** Alias para el link al perfil (null: invitado sin ficha). */
  alias: string | null
  guest: boolean
  mvp: boolean
  me: boolean
  k: number
  d: number
  a: number
  hs: number | null
  adr: number | null
  rating: number | null
  /** null en vivo y en cancelados ("—"). */
  delta: number | null
}

export type RoomSide = {
  name: string
  score: number
  result: SideResult
  players: RoomPlayer[]
}

export type Room = {
  status: RoomStatus
  map: string | null
  server: string | null
  /** Inicio (en vivo) o fecha de la partida. */
  at: string | null
  round: number | null
  stale: boolean
  tv: { host: string; port: number } | null
  demo: { status: string; url: string | null; size: number | null }
  cancelReason: string | null
  reviewPending: boolean
  side1: RoomSide
  side2: RoomSide
}

type Line = {
  player_id: string | null
  alias: string | null
  game_nick: string | null
  steam_id: string | null
  side: number | null
  kills: number | null
  deaths: number | null
  assists: number | null
  headshots: number | null
  damage: number | null
  rounds: number | null
  rating: number | null
  elo_delta?: number | null
}

/** Lo que usa la sala de GET /matches/{id} (tipo estructural: el generado no se puede asignar tal cual). */
export type MatchInput = {
  status: string
  map: string | null
  server: { name: string | null } | null
  played_at: string | null
  starts_at: string | null
  side1: { name: string | null; score: number | null }
  side2: { name: string | null; score: number | null }
  winner_side: number | null
  players: Line[]
  mvp: Line | null
  demo_status: string
  demo_url: string | null
  demo_size: number | null
  cancel_reason: string | null
  review: string | null
}

const identity = (p: Line) =>
  p.player_id ?? p.steam_id ?? p.game_nick ?? p.alias ?? ""

function toPlayer(
  p: Line,
  opts: { mvpKey: string | null; me: string | null; showDelta: boolean }
): RoomPlayer {
  const key = identity(p)
  return {
    key,
    nick: nickOf(p),
    alias: p.player_id ? p.alias : null,
    guest: p.player_id === null,
    mvp: opts.mvpKey !== null && key === opts.mvpKey,
    me: opts.me !== null && p.player_id === opts.me,
    k: p.kills ?? 0,
    d: p.deaths ?? 0,
    a: p.assists ?? 0,
    hs: hsPercent(p.headshots, p.kills),
    adr: adr(p.damage, p.rounds),
    rating: p.rating,
    delta: opts.showDelta ? (p.elo_delta ?? null) : null,
  }
}

const byRating = (a: RoomPlayer, b: RoomPlayer) =>
  (b.rating ?? -1) - (a.rating ?? -1)

function sideResult(
  status: RoomStatus,
  side: 1 | 2,
  winner: number | null
): SideResult {
  if (status === "live") return "playing"
  if (status === "cancelled") return "cancelled"
  if (winner === null) return "draw"
  return winner === side ? "win" : "loss"
}

function split(
  lines: Line[],
  status: RoomStatus,
  winner: number | null,
  names: [string | null, string | null],
  scores: [number | null, number | null],
  opts: { mvpKey: string | null; me: string | null; showDelta: boolean }
): [RoomSide, RoomSide] {
  const side = (n: 1 | 2): RoomSide => ({
    name: names[n - 1] ?? `Bando ${n}`,
    score: scores[n - 1] ?? 0,
    result: sideResult(status, n, winner),
    players: lines
      .filter((p) => p.side === n)
      .map((p) => toPlayer(p, opts))
      .sort(byRating),
  })
  return [side(1), side(2)]
}

/** Mix terminado o cancelado (`kind: "mix"`). */
export function roomFromMatch(m: MatchInput, me: string | null): Room {
  const status: RoomStatus = m.status === "cancelled" ? "cancelled" : "finished"
  const mvp = status === "cancelled" ? null : m.mvp
  const [side1, side2] = split(
    m.players,
    status,
    m.winner_side,
    [m.side1.name, m.side2.name],
    [m.side1.score, m.side2.score],
    {
      mvpKey: mvp ? identity(mvp) : null,
      me,
      showDelta: status === "finished",
    }
  )
  return {
    status,
    map: m.map,
    server: m.server?.name ?? null,
    at: m.played_at ?? m.starts_at,
    round: null,
    stale: false,
    tv: null,
    demo: { status: m.demo_status, url: m.demo_url, size: m.demo_size },
    cancelReason: m.cancel_reason,
    reviewPending: m.review === "pending",
    side1,
    side2,
  }
}

/** Mix en vivo: stats parciales, sin Δ ELO; el MVP es el mejor rating hasta ahora. */
export function roomFromLive(l: LiveMixDetail, me: string | null): Room {
  const best = [...l.players].sort(
    (a, b) => (b.rating ?? -1) - (a.rating ?? -1)
  )[0]
  const [side1, side2] = split(
    l.players,
    "live",
    null,
    [l.side1.name, l.side2.name],
    [l.side1.score, l.side2.score],
    { mvpKey: best ? identity(best) : null, me, showDelta: false }
  )
  return {
    status: "live",
    map: l.map,
    server: l.server.name,
    at: l.started_at,
    round: l.rounds_played + 1,
    stale: l.stale,
    tv: l.tv ?? null,
    demo: { status: "none", url: null, size: null },
    cancelReason: null,
    reviewPending: false,
    side1,
    side2,
  }
}
