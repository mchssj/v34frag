// Contrato provisorio del matchmaking (plan docs/bitacora/2026-10-28-matchmaking). Cuando la API
// exista, estos tipos salen de `Schemas[...]` con `pnpm gen:api` y este archivo se borra.

import type { RoomPlayer } from "@/features/mixes/room"
import type { COUNTRIES } from "@/features/profile/schemas"

export type Country = (typeof COUNTRIES)[number]

export type LobbyStatus =
  | "accepting"
  | "veto"
  | "waiting_server"
  | "assigned"
  | "connecting"
  | "live"
  | "finished"
  | "cancelled"

/** Lo equipado en la tienda (player_cosmetics_public), ya resuelto: sin lo VIP vencido. Ausente = nada. */
export type MmCosmetics = {
  /** Fondo de miniperfil, detrás de la tarjeta del grupo. */
  background_url?: string | null
  /** Marco del avatar (SVG de 256 × 256, el avatar va en el 75 % central). */
  frame_url?: string | null
  /** Clase del efecto de nombre de cosmeticos.css. */
  name_class?: string | null
  vip?: boolean
}

export type MmPlayer = MmCosmetics & {
  player_id: string
  nick: string
  level: number
  elo: number
  team: 1 | 2
  /** Dúo: los dos del grupo comparten el id y van siempre al mismo equipo. */
  party_id: string | null
  is_captain: boolean
  accepted: boolean
  connected: boolean
  /** Desconectado durante la partida: hasta cuándo puede volver. */
  left_until: string | null
  /** No volvió a tiempo (plan, decisión "Abandono"). */
  abandoned: boolean
  is_me: boolean
  photo_url: string | null
  country: Country | null
  /** Último cambio de ELO (la flecha de la tarjeta); null sin partidas. */
  elo_trend: number | null
  /** Sus últimas 30 partidas; null si no tiene ninguna. */
  recent: MmRecent | null
}

/** Promedios de las últimas 30 partidas de un jugador (vista `player_recent_stats`). */
export type MmRecent = {
  matches: number
  win_pct: number
  rating: number
  k: number
  d: number
  a: number
  kd: number
  kr: number
  adr: number
}

export type MmClip = {
  id: string
  /** `ace`, `4k`, `3k` o `clutch_N`, como en `GET /matches/{id}/clips`. */
  type: string
  round: number
  player_id: string | null
  nick: string
  kills: number
  video: {
    status:
      "pending" | "processing" | "done" | "failed" | "skipped" | "unavailable"
    url: string | null
    embed_url: string | null
    seconds: number | null
  }
}

/** La partida de la sala: desde que está en vivo. */
export type MmMatch = {
  score1: number
  score2: number
  /** Rondas de cada equipo por mitad (y prórroga); null si el resultado no lo trae. */
  halves: [number, number][] | null
  rounds: number
  winner: 1 | 2 | null
  played_at: string
  demo_url: string | null
  /** Estadísticas de la partida, con el mismo modelo que la sala de Mixes (`key` = player_id). */
  stats: RoomPlayer[]
  clips: MmClip[]
}

export type MmServer = {
  name: string
  address: string
  /** Solo la reciben los 10 de la sala, desde `assigned`. */
  password: string
}

export type MmVetoMap = {
  name: string
  /** "Dust2"; el nombre del servidor es `name`. */
  label: string
  image_url: string | null
  background_url: string | null
}

export type MmVetoBan = {
  seq: number
  team: 1 | 2
  map: string
  /** El capitán no baneó a tiempo y se baneó uno al azar. */
  auto: boolean
}

export type MmVeto = {
  pool: MmVetoMap[]
  bans: MmVetoBan[]
  /** Equipo que banea ahora; null = terminó. */
  turn: 1 | 2 | null
  deadline: string | null
}

export type MmChatMessage = {
  id: string
  nick: string
  /** null = a todos; si no, solo lo ve ese equipo. */
  team: 1 | 2 | null
  mine: boolean
  message: string
  created_at: string
}

export type ReportReason = "afk" | "toxic" | "cheat" | "abandon" | "other"

export type MmLobby = {
  id: string
  mode: string
  region: string | null
  match: MmMatch | null
  status: LobbyStatus
  map: string | null
  accept_deadline: string | null
  veto: MmVeto | null
  connect_deadline: string | null
  players: MmPlayer[]
  server: MmServer | null
  match_id: string | null
  end_reason: string | null
  chat: MmChatMessage[]
  /** player_id de los que ya reportó el que mira en esta sala. */
  reported: string[]
}

export type MmQueue = {
  mode: string
  region: string | null
  joined_at: string
  position: number
  /** ± ELO que acepta hoy la búsqueda; null = sin límite. */
  elo_window: number | null
}

export type MmPartyMember = MmCosmetics & {
  player_id: string
  nick: string
  level: number
  elo: number
  is_me: boolean
  is_leader: boolean
}

export type MmParty = {
  id: string
  members: MmPartyMember[]
  max_size: number
  /** Invitación que mandó el grupo y todavía no se respondió. */
  pending: { to_nick: string; expires_at: string } | null
}

export type MmInvite = {
  id: string
  from: Omit<MmPartyMember, "is_me" | "is_leader">
  expires_at: string
}

/** Resultado de la búsqueda para invitar al dúo. */
export type MmPlayerHit = Omit<MmPartyMember, "is_me" | "is_leader">

export type MmPenalty = { until: string; level: number }

export type MmMode = {
  mode: string
  players_per_team: number
  enabled: boolean
  /** 2v2 y 1v1 no dan ELO (plan, decisión "ELO en 2v2 y 1v1"). */
  affects_elo: boolean
}

export type InvitePref = "private" | "public"

/** La ficha del que mira: la tarjeta del medio y el ELO de arriba. */
export type MmMe = MmCosmetics & {
  nick: string
  country: Country | null
  photo_url: string | null
  elo: number
  level: number
  /** Últimos 5 resultados, del más nuevo al más viejo. */
  recent: ("W" | "L")[]
}

export type MmState = {
  open: boolean
  me: MmMe
  /** Solo los habilitados. */
  modes: MmMode[]
  /** Regiones de los servidores con matchmaking. */
  regions: string[]
  max_party_size: number
  invites_pref: InvitePref
  queue_size: number
  /** Jugadores con la página abierta o en una sala. */
  active_players: number
  live_matches: number
  queue: MmQueue | null
  lobby: MmLobby | null
  party: MmParty | null
  invites: MmInvite[]
  penalty: MmPenalty | null
  /** Exclusión del matchmaking por un reporte. */
  ban: { until: string; reason: string } | null
  /** Cuenta nueva: lo que le falta para poder jugar; null = ya puede. */
  newcomer: { mixes_left: number; days_left: number } | null
  servers: { free: number; total: number }
  /** Cierre de la temporada si es dentro de la próxima hora. */
  season: { ends_at: string; queue_closes_at: string } | null
  /** Por qué no puede entrar (sin ficha, sin SteamID, sanción…); null = puede. */
  block_reason: string | null
}

/** Evento del socket: solo el tipo y la sala; el estado se vuelve a pedir por REST. */
export type MmEvent = { t: string; lobby?: string }

export type PasswordKind = "mix" | "idle"

export type MmPasswordEntry = {
  id: string
  password: string
  kind: PasswordKind
  lobby_id: string | null
  /** "plugin", "system" o el alias del admin que la rotó. */
  set_by: string
  created_at: string
  /** null = pedida por un admin y el servidor todavía no la puso. */
  applied_at: string | null
}

export type MmAdminServer = {
  id: string
  name: string
  address: string
  state: "free" | "lobby" | "live" | "offline"
  region: string | null
  mm_enabled: boolean
  password: MmPasswordEntry | null
}

/** Administración › Matchmaking › General (`mm_config` más los modos). */
export type MmAdminConfig = {
  open: boolean
  modes: MmMode[]
  max_party_size: number
  party_max_elo_gap: number
  accept_seconds: number
  veto_seconds: number
  connect_minutes: number
  server_wait_minutes: number
  elo_window_start: number
  elo_window_step: number
  elo_window_every_s: number
  elo_window_max: number
  elo_unlimited_after_s: number
  /** Minutos de cada escalón de sanción. */
  penalty_ladder: number[]
  reconnect_minutes: number
  min_mixes: number
  min_account_days: number
  season_queue_close_minutes: number
}

export type MmAdminMap = {
  name: string
  label: string
  image_url: string | null
  /** Está en el veto del modo elegido (`mm_mode_maps`). */
  in_mm: boolean
}

export type ReportStatus = "pending" | "dismissed" | "warned" | "banned"

export type MmAdminReport = {
  id: string
  lobby_id: string
  mode: string
  reporter: string
  reported: string
  reported_user_id: string
  reason: ReportReason
  note: string | null
  created_at: string
  status: ReportStatus
}

export type MmAdminBan = {
  user_id: string
  nick: string
  until: string
  reason: string
}

/** Una fila de `mm_stats_daily`. */
export type MmStatsDay = {
  day: string
  mode: string
  lobbies: number
  played: number
  cancelled: Record<string, number>
  avg_wait_s: number
  p90_wait_s: number
  avg_elo_diff: number
  abandons: number
}

export type MmAdminLobby = {
  id: string
  mode: string
  status: LobbyStatus
  map: string | null
  server: string | null
  players: number
  created_at: string
}

/** Un mapa del catálogo (`map_pool`), el mismo para Mixes, PCW, torneos y matchmaking. */
export type MmCatalogMap = {
  name: string
  /** Nombre visible; null = se arma del nombre (`de_dust2` → "Dust2"). */
  display_name: string | null
  /** Versiones del servidor; la primera es el nombre. */
  versions: string[]
  active: boolean
  /** Tarjeta del veto y fondo del marcador de Mixes. */
  image_url: string | null
  /** Fondo grande de la sala de matchmaking. */
  background_url: string | null
}

export type MapArt = "image" | "background"
