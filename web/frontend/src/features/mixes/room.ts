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
  hsKills: number
  adr: number | null
  rounds: number
  k2: number
  k3: number
  k4: number
  k5: number
  /** Primeros duelos de la ronda ganados (fk) y perdidos (fd). */
  fk: number
  fd: number
  plants: number
  defuses: number
  /** Clutches ganados, 1v1 a 1v5. null en vivo (se cuentan al terminar). */
  clutches: number[] | null
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
  /** Si hay datos de clutch (el servidor ya mandaba jugadas). null en vivo. */
  clutchData: boolean | null
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
  k2?: number | null
  k3?: number | null
  k4?: number | null
  k5?: number | null
  first_kills?: number | null
  first_deaths?: number | null
  plants?: number | null
  defuses?: number | null
  clutches?: Partial<Record<"1" | "2" | "3" | "4" | "5", number>> | null
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
  clutch_data?: boolean
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
    hsKills: p.headshots ?? 0,
    adr: adr(p.damage, p.rounds),
    rounds: p.rounds ?? 0,
    k2: p.k2 ?? 0,
    k3: p.k3 ?? 0,
    k4: p.k4 ?? 0,
    k5: p.k5 ?? 0,
    fk: p.first_kills ?? 0,
    fd: p.first_deaths ?? 0,
    plants: p.plants ?? 0,
    defuses: p.defuses ?? 0,
    clutches: p.clutches
      ? (["1", "2", "3", "4", "5"] as const).map((n) => p.clutches?.[n] ?? 0)
      : null,
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
    clutchData: m.clutch_data ?? false,
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
    clutchData: null,
    side1,
    side2,
  }
}
