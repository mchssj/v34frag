import { mapLabel } from "@/features/matchmaking/labels"
import { levelOf } from "@/features/matchmaking/room/roomData"
import type {
  LobbyStatus,
  MmLobby,
  MmPlayer,
  MmVetoMap,
} from "@/features/matchmaking/types"
import { LEVEL_FLOORS } from "@/features/player/lib/labels"
import type { PcwBooking, PcwMatch, PcwPlayer } from "../types"
import { sideName } from "./pcw"
import {
  ENTRY_RULE,
  NEEDED,
  seriesScore,
  vetoState,
  waitMinutes,
} from "./series"

// La sala de una PCW es la misma sala del matchmaking (Kyan, 2026-11-08): esto arma la "sala" (MmLobby) con la serie
// de la PCW. Lo propio de la PCW (marcador de la serie, reglas) va aparte, arriba del centro.

const STATUS: Record<PcwBooking["step"], LobbyStatus> = {
  veto: "veto",
  queued: "waiting_server",
  wait: "connecting",
  live: "live",
  finished: "finished",
  abandoned: "cancelled",
}

/** El mapa que toca ahora (o null mientras dura el veto). */
export function currentMap(m: PcwMatch): string | null {
  const b = m.booking!
  const v = vetoState(b.pool, m.best_of, b.actions)
  return v.done ? (v.maps[Math.min(b.map_no, v.maps.length) - 1] ?? null) : null
}

function hint(m: PcwMatch): string {
  const b = m.booking!
  switch (b.step) {
    case "queued":
      return b.queue_ahead > 0
        ? `Los dos están listos. Hay ${b.queue_ahead} PCW antes en la fila de servidores.`
        : "Los dos están listos. Estamos eligiendo un servidor libre para PCW."
    case "wait":
      return `Entren: ${ENTRY_RULE}. Tienen ${waitMinutes(b.map_no)} min para el mapa ${b.map_no}; con los dos en regla arranca solo.`
    case "live":
      return `Mapa ${b.map_no} de la serie. El resultado se carga solo al terminar.`
    case "finished":
      return "La serie terminó. Una PCW no mueve el ELO."
    default:
      return ""
  }
}

export function pcwToLobby(
  m: PcwMatch,
  meId: string,
  mapImage: (name: string) => string | null
): MmLobby {
  const b = m.booking!
  const v = vetoState(b.pool, m.best_of, b.actions)
  const [us, them] = seriesScore(b.scores)
  const inServer = b.step === "wait" || b.step === "live"
  const pool: MmVetoMap[] = b.pool.map((name) => ({
    name,
    label: mapLabel(name),
    image_url: mapImage(name),
    team1_win_pct: null,
    team2_win_pct: null,
  }))
  const player = (p: PcwPlayer, team: 1 | 2, i: number): MmPlayer => ({
    player_id: p.id,
    nick: p.alias,
    level: p.guest ? 1 : levelOf(p.elo, LEVEL_FLOORS),
    elo: p.elo,
    team,
    party_id: null,
    // El primero de cada roster hace el veto, como el capitán del matchmaking.
    is_captain: i === 0,
    accepted: true,
    connected: inServer && i < b.present[team - 1],
    left_until: null,
    abandoned: false,
    is_me: p.id === meId,
    photo_url: p.photo ?? null,
    country: null,
    anticheat: true,
    form: [],
    fav_map: null,
    meetings: { with: [], against: [] },
    elo_trend: null,
    recent: null,
  })
  return {
    id: `pcw-${m.id}`,
    mode: `BO${m.best_of}`,
    region: null,
    match: null,
    status: STATUS[b.step],
    map: currentMap(m),
    accept_deadline: null,
    veto: {
      pool,
      bans: b.actions.map((a, i) => ({
        seq: i + 1,
        team: a.by === "us" ? 1 : 2,
        map: a.map,
        auto: false,
        kind: a.kind,
      })),
      turn: v.next ? (v.next.by === "us" ? 1 : 2) : null,
      deadline: b.step === "veto" ? b.deadline : null,
      next_kind: v.next?.kind,
    },
    connect_deadline: b.step === "wait" ? b.deadline : null,
    players: [
      ...m.us.roster.map((p, i) => player(p, 1, i)),
      ...m.them.roster.map((p, i) => player(p, 2, i)),
    ],
    server: b.server ? { ...b.server, tv: null } : null,
    match_id: m.id,
    end_reason:
      b.step === "abandoned"
        ? b.abandoned_by === "them"
          ? `${sideName(m.them)} no entró a tiempo: la PCW no cuenta y queda sin PCW 3 días.`
          : `No llegaron a ${NEEDED} adentro a tiempo: la PCW no cuenta y quedan sin PCW 3 días.`
        : null,
    reported: [],
    commended: null,
    // Una PCW no da ELO.
    elo_stake: null,
    sides: { 1: sideName(m.us), 2: sideName(m.them) },
    // El escudo si juega como equipo; un mix de amigos queda con la foto del capitán.
    crests: { 1: m.us.team, 2: m.them.team },
    kind_label: `PCW BO${m.best_of} · serie ${us}-${them}`,
    status_hint: hint(m),
  }
}
