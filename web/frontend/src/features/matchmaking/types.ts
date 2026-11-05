// Contrato provisorio del matchmaking (plan docs/bitacora/2026-10-28-matchmaking). Cuando la API
// exista, estos tipos salen de `Schemas[...]` con `pnpm gen:api` y este archivo se borra.

import type { RoomPlayer } from "@/features/mixes/lib/room"
import type { COUNTRIES } from "@/features/profile/lib/schemas"

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

/** Si la cuenta es VIP (`is_vip()`). Los cosméticos de la tienda llegan con la tienda. */
export type MmVip = {
  vip?: boolean
}

export type MmPlayer = MmVip & {
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
  /** Si su ficha tiene SteamID; sin vincular hace !claim en el servidor de la sala. Sin el campo, vinculado. */
  linked?: boolean
  photo_url: string | null
  country: Country | null
  /** Agente del anticheat activo (`ac_public_status`). */
  anticheat: boolean
  /** Últimos 5 resultados, del más nuevo al más viejo. */
  form: ("W" | "L")[]
  /** Su mejor mapa en las últimas partidas. */
  fav_map: { map: string; win_pct: number } | null
  /** Partidas anteriores con este jugador (de quien mira): en su equipo y en contra. */
  meetings: { with: MmMeeting[]; against: MmMeeting[] }
  /** Último cambio de ELO (la flecha de la tarjeta); null sin partidas. */
  elo_trend: number | null
  /** Sus últimas 30 partidas; null si no tiene ninguna. */
  recent: MmRecent | null
}

export type MmMeeting = {
  match_id: string
  map: string | null
  played_at: string
  /** Si ganó quien mira. */
  won: boolean
  score: string
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
  /** SourceTV (`game_servers.tv_port`), para "Ver en CM League TV". */
  tv: { host: string; port: number } | null
}

export type MmVetoMap = {
  name: string
  /** "Dust2"; el nombre del servidor es `name`. */
  label: string
  image_url: string | null
  /** % de victorias de cada equipo en este mapa (promedio de sus jugadores); null sin datos. */
  team1_win_pct: number | null
  team2_win_pct: number | null
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
  message: string
  created_at: string
}

export type ReportReason = "afk" | "toxic" | "cheat" | "abandon" | "other"

export type MmLobby = {
  id: string
  mode: string
  /** Imagen fija de la tarjeta del MVP (Administración › Matchmaking › General). */
  mvp_image_url?: string | null
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
  /** player_id de los que ya reportó el que mira en esta sala. */
  reported: string[]
  /** A quién felicitó el que mira en esta partida (uno por partida). */
  commended: string | null
  /** ELO en juego para el que mira; null si el modo no da ELO. */
  elo_stake: { win: number; loss: number } | null
}

export type MmQueue = {
  mode: string
  region: string | null
  joined_at: string
  position: number
  /** ± ELO que acepta hoy la búsqueda; null = sin límite. */
  elo_window: number | null
  /** Espera estimada en segundos; null sin datos o sin servidores libres. */
  eta_s: number | null
}

export type MmPartyMember = MmVip & {
  player_id: string
  nick: string
  /** Foto de la ficha o, si no tiene, el avatar del perfil (replanteo 55). */
  photo_url?: string | null
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
export type MmMe = MmVip & {
  nick: string
  country: Country | null
  photo_url: string | null
  elo: number
  level: number
  /** Últimos 5 resultados, del más nuevo al más viejo. */
  recent: ("W" | "L")[]
}

export type MmSound = { id: string; name: string; url: string }

export type MmFriend = {
  player_id: string
  nick: string
  level: number
  /** null = todavía no te marcó, así que no se ve su estado. */
  status: "free" | "queue" | "playing" | "offline" | null
}

export type MmSanction = {
  id: string
  kind: "penalty" | "mm_ban" | "server_ban"
  reason: string
  created_at: string
  /** null = sin vencimiento. */
  until: string | null
}

export type MmState = {
  /** Hora del servidor: la usan las cuentas regresivas (`serverClock`). */
  server_now?: string
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
  /** La sala abierta (aceptando, veto, conectando o en vivo). */
  lobby: MmLobby | null
  /** La última sala terminada, sin las estadísticas: la pestaña "Tu última partida" (replanteo 60). */
  last_lobby?: MmLobby | null
  /** Cuándo lo sacamos de la cola por cerrar la web, si fue en los últimos 10 min (replanteo 63). */
  queue_dropped_at?: string | null
  party: MmParty | null
  invites: MmInvite[]
  penalty: MmPenalty | null
  /** Bloqueo de compañeros: con quién no te toca en el mismo equipo. */
  blocks: {
    list: { player_id: string; nick: string }[]
    max: number
    vip_only: boolean
    /** Si esta cuenta puede usarlo. */
    allowed: boolean
  }
  /** Quién está buscando ahora, por modo y por nivel. */
  queue_activity: {
    modes: { mode: string; searching: number; missing: number }[]
    levels: { label: string; count: number }[]
    /** Quiénes están buscando, los que más esperan primero (hasta 50). */
    players: { player_id: string; nick: string; level: number; mode: string }[]
  }
  /** Sonido de partida encontrada. */
  sounds: {
    /** Los que subieron los admins. */
    catalog: MmSound[]
    /** El elegido; null = el predeterminado. */
    selected: string | null
    /** El propio, si es VIP y subió uno. */
    custom: MmSound | null
    can_upload: boolean
    /** Qué reproducir; null = el predeterminado. */
    url: string | null
  }
  /** A quiénes marcó como amigos. */
  friends: MmFriend[]
  /** Historial propio: sanciones de la cola, exclusiones y baneos del servidor. */
  sanctions: {
    items: MmSanction[]
    /** Escalón actual de la escalera de sanciones y cuándo baja. */
    level: number
    level_resets_at: string | null
  }
  /** Anticheat: si la cola lo exige y cómo está el agente de quien mira. */
  anticheat: { required: boolean; status: "ok" | "no_agent" | "stale" }
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
export type MmEvent = {
  t: string
  lobby?: string
  /** Lo que cambió (replanteo 59): tamaños de la cola, plazo de la sala encontrada, quién aceptó, el veto. */
  d?: unknown
  /** En `friend.searching`: el amigo que entró a la cola. */
  friend?: { player_id: string; nick: string }
}

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
  state: "free" | "lobby" | "booking" | "live" | "offline"
  region: string | null
  mm_enabled: boolean
  official_enabled?: boolean
  pcw_enabled?: boolean
  password: MmPasswordEntry | null
}

/** Aviso de la cola en Discord (replanteo 57): uno cada 15 minutos para todos; el staff, siempre. */
export type QueuePingStatus = {
  staff: boolean
  queued: boolean
  /** Desde cuándo se puede volver a avisar; null si ya se puede. */
  next_at: string | null
  can_ping: boolean
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
  /** Exigir el agente del anticheat para jugar. */
  require_anticheat: boolean
  max_blocks: number
  blocks_vip_only: boolean
  min_mixes: number
  min_account_days: number
  season_queue_close_minutes: number
  /** Repartir los equipos con el ELO de armado: ELO + ajuste por el rating reciente (replanteo 73). */
  balance_rating: boolean
  /** Puntos de ELO de armado por cada 1,00 de rating sobre o bajo 1,00. */
  balance_rating_weight: number
  /** Máximo que el rating sube o baja el ELO de armado. */
  balance_rating_cap: number
  /** Mapas con rating 1,00 que se suman para corregir el de los que jugaron poco. */
  balance_rating_prior_maps: number
  /** Días de partidas 5v5 que se miran. */
  balance_rating_days: number
  /** Imagen de la tarjeta del MVP; se sube y se quita aparte (no viaja en saveConfig). */
  mvp_image_url?: string | null
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

/** Sanción automática de la cola vigente (replanteo 61): el motivo es el de la última falta. */
export type MmAdminPenalty = {
  user_id: string
  player_id: string | null
  nick: string | null
  level: number
  max_level: number
  reason: string | null
  since: string | null
  until: string
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

/** Lo que se muestra debajo de Mi grupo; sale de rutas que ya existen. */
export type MmFeed = {
  /** La mejor jugada de la semana; null si no hay. */
  highlight: {
    match_id: string
    nick: string
    title: string
    image_url: string | null
  } | null
  live: {
    uid: string
    map: string | null
    image_url: string | null
    side1_name: string
    side2_name: string
    score1: number
    score2: number
    round: number
  }[]
  recent: {
    match_id: string
    map: string | null
    image_url: string | null
    won: boolean
    score: string
    kills: number
    deaths: number
    rating: number | null
    elo_delta: number | null
  }[]
  top: {
    position: number
    nick: string
    photo_url: string | null
    elo: number
    level: number
  }[]
}
