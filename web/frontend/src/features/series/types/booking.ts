// Reserva del servidor de una partida de torneo o PCW (GET /api/v1/matches/{id}/booking, replanteo 56).
// La ruta todavía no está en la OpenAPI del frontend: los tipos van a mano, como en el matchmaking.

export type BookingStatus =
  | "ready"
  | "veto"
  | "queued"
  | "assigned"
  | "live"
  | "between"
  | "lost"
  | "finished"
  | "abandoned"
  | "cancelled"

export type BookingServer = { id: string; name: string; region: string | null }

export type Booking = {
  id: string
  status: BookingStatus
  kind: "official" | "pcw"
  server: BookingServer | null
  /** Mapa que toca (de los del veto); null si el veto no terminó. */
  map: string | null
  map_no: number
  veto_deadline: string | null
  wait_started_at: string | null
  wait_deadline: string | null
  wait_expired: boolean
  wait_minutes: number
  min_roster1: number | null
  min_roster2: number | null
  ready1: boolean
  ready2: boolean
  /** El servidor ya la tomó. */
  taken: boolean
  side_ok1: boolean | null
  side_ok2: boolean | null
  side_n1: number | null
  side_n2: number | null
  queue_position: number | null
  lost_at: string | null
  created_at: string
  ended_at: string | null
  end_reason: string | null
  /** PCW abandonada: 1 o 2 (equipo de la partida), 3 = los dos. */
  abandoned_side: 1 | 2 | 3 | null
  /** Solo para planteles, streamers, el organizador y los moderadores. */
  connection: { address: string; password: string; url: string } | null
}

export type MatchBooking = {
  kind: "official" | "pcw"
  veto_done: boolean
  can_veto: boolean
  veto_turn_seconds: number
  maps: string[]
  /** 1 o 2 si la cuenta es de un plantel; 0 si no. */
  my_side: 0 | 1 | 2
  can_manage: boolean
  can_start: boolean
  can_ready: boolean
  ban_until: string | null
  booking: Booking | null
}

export type FreeServer = BookingServer

export type BookingAction =
  | { action: "allow_four"; side: 1 | 2 }
  | { action: "extend"; minutes: number }
  | { action: "cancel" }
  | { action: "release" }
