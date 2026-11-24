// Lo que usa el launcher de los tipos del matchmaking. Copiado (recortado) de
// web/frontend/src/features/matchmaking/types.ts: si allá cambia un campo, se cambia acá.

export type LobbyStatus =
  | "accepting"
  | "veto"
  | "waiting_server"
  | "assigned"
  | "connecting"
  | "live"
  | "finished"
  | "cancelled"

export type MmPlayer = {
  player_id: string
  nick: string
  team: 1 | 2
  accepted: boolean
  connected: boolean
  is_me: boolean
}

export type MmServer = {
  name: string
  address: string
  /** Solo la reciben los 10 de la sala, desde `assigned`. */
  password: string
}

export type MmLobby = {
  id: string
  mode: string
  status: LobbyStatus
  map: string | null
  accept_deadline: string | null
  connect_deadline: string | null
  players: MmPlayer[]
  server: MmServer | null
}

export type MmQueue = {
  mode: string
  region: string | null
  joined_at: string
  position: number
  eta_s: number | null
}

export type MmMode = { mode: string; players_per_team: number; enabled: boolean; affects_elo: boolean }

export type MmState = {
  server_now?: string
  open: boolean
  modes: MmMode[]
  regions: string[]
  queue_size: number
  active_players: number
  live_matches: number
  queue: MmQueue | null
  lobby: MmLobby | null
  penalty: { until: string; level: number } | null
}

export type MmEvent = { t: string; lobby?: string; d?: unknown }
