import type { Schemas } from "@/api/client"
import type { SeriesDetail } from "@/features/series/lib/series"
import type { MatchBooking } from "@/features/series/types/booking"
import type {
  BestOf,
  MatchStatus,
  PcwBooking,
  PcwMatch,
  PcwOffer,
  PcwPlayer,
  PcwPost,
  PcwResult,
  PcwSide,
  PcwTeamRef,
} from "../types"

// De la API a los tipos de la página de PCW (bitácora 2026-11-08-pcw-real). La página es la del prototipo de Kyan:
// estas funciones son lo único que sabe de la forma de la API.

type ApiSide = Schemas["PcwSide"]
type ApiRosterPlayer = ApiSide["roster"][number]
export type PcwContext = Schemas["PcwContext"]

/** Lo que se lee de un resumen de partida (MatchSummary y MatchListItem). */
type SideSummary = {
  name: string | null
  team: { id: string; name: string; tag: string | null } | null
  score: number | null
}
type MatchSummaryLike = {
  id: string
  status: "upcoming" | "live" | "finished" | "cancelled"
  best_of: number
  starts_at: string | null
  played_at: string | null
  winner_side: number | null
  side1: SideSummary
  side2: SideSummary
}
/** Una fila de GET /me/pcw/matches (replanteo 92). */
export type ApiMyPcwMatch = MatchSummaryLike & {
  my_side: 1 | 2
  booking: { status: string; ready1: boolean; ready2: boolean } | null
  pcw_sides: { "1": ApiSide | null; "2": ApiSide | null }
}

const bestOf = (n: number): BestOf => (n === 5 ? 5 : n === 3 ? 3 : 1)

export function toPlayer(p: ApiRosterPlayer): PcwPlayer {
  return {
    // Un invitado no tiene ficha: el tag lo identifica dentro del roster.
    id: p.player_id ?? `guest-${p.alias.toLowerCase()}`,
    alias: p.alias,
    elo: p.elo ?? 0,
    photo: null,
    guest: p.guest || undefined,
  }
}

export function toSide(s: ApiSide | null | undefined, fallback = "?"): PcwSide {
  if (!s) return { name: fallback, team: null, roster: [] }
  const team: PcwTeamRef | null = s.plays_as
    ? {
        id: s.plays_as.id,
        name: s.plays_as.name,
        tag: s.plays_as.tag,
        rank: s.rank,
      }
    : null
  return { name: s.name || fallback, team, roster: s.roster.map(toPlayer) }
}

export function toOffer(o: Schemas["PcwOffer"]): PcwOffer {
  return {
    id: o.id,
    side: toSide(o.side),
    proposed_at: o.starts_at,
    created_at: o.created_at,
    reliability: null,
  }
}

export function toPost(p: Schemas["PcwPost"]): PcwPost {
  return {
    id: p.id,
    by: p.by.user_id,
    best_of: bestOf(p.best_of),
    starts_at: p.starts_at,
    note: p.note,
    created_at: p.created_at,
    map_pool: p.map_pool,
    side: toSide(p.side),
    // Ideas sin backend todavía: desafío directo, aviso en Discord y confiabilidad.
    invited: null,
    discord: false,
    reliability: null,
    offers: p.offers?.map(toOffer),
    my_offer: p.my_offer
      ? {
          id: p.my_offer.id,
          created_at: p.my_offer.created_at,
          proposed_at: p.my_offer.starts_at,
        }
      : null,
  }
}

/** Estado de la reserva que pide "ir a la sala" (los dos listos): veto, fila, espera para entrar o en juego. */
const STEP: Partial<Record<string, PcwBooking["step"]>> = {
  veto: "veto",
  queued: "queued",
  assigned: "wait",
  between: "wait",
  lost: "wait",
  live: "live",
}

/** Una reserva vacía con el paso: lo que necesita la lista de Mis PCW (el detalle lo trae la sala). */
export function stubBooking(step: PcwBooking["step"]): PcwBooking {
  return {
    step,
    pool: [],
    actions: [],
    deadline: null,
    queue_ahead: 0,
    server: null,
    map_no: 1,
    present: [0, 0],
    scores: [],
    abandoned_by: null,
  }
}

/** Una práctica mía (GET /me/pcw/matches) con lo que muestra Mis PCW. */
export function toMatch(m: ApiMyPcwMatch): PcwMatch {
  const mine = m.my_side
  const other = mine === 1 ? 2 : 1
  const sideApi = (n: 1 | 2) => m.pcw_sides[String(n) as "1" | "2"]
  const sideSum = (n: 1 | 2) => (n === 1 ? m.side1 : m.side2)
  const us = toSide(sideApi(mine), sideSum(mine).name ?? "?")
  const them = toSide(sideApi(other), sideSum(other).name ?? "?")
  let status: MatchStatus
  let booking: PcwBooking | null = null
  if (m.status === "finished") status = m.winner_side === mine ? "won" : "lost"
  else if (m.status === "cancelled") status = "cancelled"
  else if (m.status === "live") status = "live"
  else {
    const b = m.booking
    const meReady = !!b && (mine === 1 ? b.ready1 : b.ready2)
    const themReady = !!b && (mine === 1 ? b.ready2 : b.ready1)
    status =
      meReady && themReady ? "ready_both" : meReady ? "ready_us" : "waiting"
    const step = b ? STEP[b.status] : undefined
    if (step && meReady && themReady) booking = stubBooking(step)
  }
  if (m.status === "live" && m.booking)
    booking = stubBooking(STEP[m.booking.status] ?? "live")
  const score: [number, number] | null =
    m.status === "finished"
      ? [sideSum(mine).score ?? 0, sideSum(other).score ?? 0]
      : null
  return {
    id: m.id,
    best_of: bestOf(m.best_of),
    starts_at: m.starts_at,
    us,
    them,
    status,
    them_ready:
      !!m.booking && (mine === 1 ? m.booking.ready2 : m.booking.ready1),
    score,
    proposed_at: null,
    proposed_by: null,
    map_pool: null,
    booking,
  }
}

/** Una PCW jugada (GET /matches?kind=pcw) para la actividad y el historial. */
export function toResult(m: MatchSummaryLike): PcwResult {
  const ref = (s: SideSummary): PcwTeamRef => ({
    id: s.team?.id ?? s.name ?? "?",
    name: s.team?.name ?? s.name ?? "?",
    tag: s.team?.tag ?? null,
  })
  return {
    id: m.id,
    at: m.played_at ?? m.starts_at ?? new Date().toISOString(),
    a: ref(m.side1),
    b: ref(m.side2),
    score: [m.side1.score ?? 0, m.side2.score ?? 0],
  }
}

/** Mi ficha y mi equipo, del contexto (GET /me/pcw/context). */
export function contextPlayers(ctx: PcwContext | undefined) {
  const me: PcwPlayer = ctx?.me
    ? { id: ctx.me.player_id, alias: ctx.me.alias, elo: ctx.me.elo ?? 0 }
    : { id: "me", alias: "vos", elo: 0 }
  const team: PcwTeamRef | null = ctx?.team
    ? {
        id: ctx.team.id,
        name: ctx.team.name,
        tag: ctx.team.tag,
        rank: ctx.team.rank,
      }
    : null
  const plantel: PcwPlayer[] = (ctx?.team?.plantel ?? []).map((p) => ({
    id: p.player_id,
    alias: p.alias,
    elo: p.elo ?? 0,
  }))
  const friends = (ctx?.friends ?? []).map((f) => ({
    id: f.player_id,
    alias: f.alias,
    elo: f.elo ?? 0,
    team: f.teammate,
  }))
  return { me, team, plantel, friends }
}

// ---------- La sala: la serie real (GET /matches/{id} y su reserva) como una PcwMatch con su reserva ----------

/** El paso de la serie desde la reserva de la base (replanteo 56). */
function stepOf(mb: MatchBooking, d: SeriesDetail): PcwBooking["step"] {
  const b = mb.booking
  if (!b) return d.status === "finished" ? "finished" : "queued"
  if (b.status === "abandoned") return "abandoned"
  if (b.status === "finished" || d.status === "finished") return "finished"
  return STEP[b.status] ?? "queued"
}

/**
 * La serie de una PCW en la sala. En la sala "us" es el equipo 1 y "them" el 2, como en la base: el veto lo empieza el
 * equipo 1 y se alterna, igual que el orden de la página (`vetoOrder`).
 */
export function seriesToMatch(
  d: SeriesDetail,
  mb: MatchBooking,
  sides: { 1: PcwSide; 2: PcwSide } | null
): PcwMatch {
  const b = mb.booking
  const team1 = d.side1.team?.id ?? null
  const step = stepOf(mb, d)
  const games = d.games
    .filter((g) => g.score1 !== null && g.score2 !== null)
    .map((g) => [g.score1 ?? 0, g.score2 ?? 0] as [number, number])
  const roster = (n: 1 | 2): PcwSide => {
    if (sides) return sides[n]
    const side = n === 1 ? d.side1 : d.side2
    const list = (n === 1 ? d.roster1 : d.roster2) ?? []
    return {
      name: side.name ?? side.team?.name ?? "?",
      team: null,
      roster: list.map((p) => toPlayer({ ...p, elo: null })),
    }
  }
  const pool = d.veto?.pool.map((p) => p.name) ?? []
  const booking: PcwBooking = {
    step,
    pool,
    actions: (d.veto?.actions ?? []).map((a) => ({
      map: a.map,
      kind: a.action,
      by: a.team_id === team1 ? "us" : "them",
    })),
    deadline:
      step === "veto"
        ? (b?.veto_deadline ?? null)
        : step === "wait"
          ? (b?.wait_deadline ?? null)
          : null,
    queue_ahead: Math.max(0, (b?.queue_position ?? 1) - 1),
    server:
      b?.server && b.connection
        ? {
            name: b.server.name,
            address: b.connection.address,
            password: b.connection.password,
          }
        : null,
    map_no: b?.map_no ?? 1,
    present: [b?.side_n1 ?? 0, b?.side_n2 ?? 0],
    scores: games,
    abandoned_by:
      b?.abandoned_side === 1 ? "us" : b?.abandoned_side === 2 ? "them" : null,
  }
  return {
    id: d.id,
    best_of: bestOf(d.best_of),
    starts_at: d.starts_at,
    us: roster(1),
    them: roster(2),
    status: d.status === "finished" ? "won" : "ready_both",
    score: null,
    proposed_at: null,
    proposed_by: null,
    map_pool: pool,
    booking,
  }
}
