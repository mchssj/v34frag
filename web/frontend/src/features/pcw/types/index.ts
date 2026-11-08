import type { Schemas } from "@/api/client"

// Tipos de la página de PCW. Lo que dice "API" ya existe (PcwPost, PcwSide, GET /me/pcw/*);
// lo marcado "backend" es de las ideas que Daniel tendría que sumar (bitácora 2026-11-08-pcw-demo).

export type PcwPostApi = Schemas["PcwPost"]
export type BestOf = 1 | 3 | 5

export type PcwPlayer = {
  id: string
  alias: string
  elo: number
  photo?: string | null
  /** Invitado sin cuenta: no suma al mínimo de 4 ni tiene ELO. */
  guest?: boolean
}

export type PcwTeamRef = {
  id: string
  name: string
  tag: string | null
  /** Puesto en el ranking de equipos (vista team_ranking); null sin puesto. */
  rank?: number | null
}

/** Un bando: el equipo oficial con el que juega (o null si es un mix de amigos) y su roster. */
export type PcwSide = {
  name: string
  team: PcwTeamRef | null
  roster: PcwPlayer[]
}

/** backend: PCW jugadas, canceladas y abandonadas del equipo, y la racha sin cancelar. */
export type Reliability = {
  played: number
  cancelled: number
  abandoned: number
  streak: number
}

export type PcwPost = {
  // API
  id: string
  by: string
  best_of: BestOf
  starts_at: string | null
  note: string | null
  created_at: string
  /** null: el pool por defecto. */
  map_pool: string[] | null
  side: PcwSide
  // backend
  /** Desafío directo: solo ese equipo la puede aceptar. */
  invited: PcwTeamRef | null
  discord: boolean
  reliability: Reliability | null
  /** backend: en mi anuncio, las ofertas que llegaron (como en pracc: el que publicó elige). */
  offers?: PcwOffer[]
  /** backend: en uno del tablón, la oferta que mandé y todavía no eligieron. */
  my_offer?: { created_at: string; proposed_at: string | null } | null
}

/** backend: un aviso de PCW en la campana (y por Discord si `discord`). */
export type PcwNotice = {
  id: string
  kind: "offer" | "chosen" | "rejected" | "soon"
  text: string
  at: string
  read: boolean
  /** También llega por Discord (mensaje directo del bot). */
  discord: boolean
  /** La práctica a la que lleva, si hay. */
  match_id?: string
  /** El otro equipo (data.team de la notificación). */
  team?: string
  /** Minutos que faltan (pcw_soon). */
  minutes?: number
}

/** backend: una oferta a un anuncio. El que publicó elige una y las demás quedan rechazadas. */
export type PcwOffer = {
  id: string
  side: PcwSide
  /** Otra hora que propone (o null: la del anuncio). */
  proposed_at: string | null
  created_at: string
  reliability: Reliability | null
}

export type MatchStatus =
  "waiting" | "ready_us" | "ready_both" | "live" | "won" | "lost" | "cancelled"

/** Una práctica mía (GET /me/pcw/matches), con lo que la página necesita. */
export type PcwMatch = {
  id: string
  best_of: BestOf
  starts_at: string | null
  us: PcwSide
  them: PcwSide
  status: MatchStatus
  /** Mapas ganados por cada lado. */
  score: [number, number] | null
  /** backend: contraoferta de hora pendiente y quién la hizo. */
  proposed_at: string | null
  proposed_by: "us" | "them" | null
  /** El pool del anuncio (null: el por defecto). Si tiene tantos mapas como el formato, se juega sin veto. */
  map_pool?: string[] | null
  /** La serie después de "los dos listos" (GET /matches/{id}/booking, replanteo 56). */
  booking?: PcwBooking | null
}

export type VetoKind = "ban" | "pick"
export type VetoAction = { map: string; kind: VetoKind; by: "us" | "them" }

/** Reserva de la serie (match_bookings): veto, fila, espera para entrar, en juego, abandono. */
export type PcwBooking = {
  step: "veto" | "queued" | "wait" | "live" | "abandoned" | "finished"
  pool: string[]
  actions: VetoAction[]
  /** Fin del turno del veto o de la espera para entrar. */
  deadline: string | null
  /** PCW antes en la fila de servidores. */
  queue_ahead: number
  server: { name: string; address: string; password: string } | null
  /** Mapa que toca (desde 1). */
  map_no: number
  /** Jugadores adentro del servidor: nosotros y ellos. */
  present: [number, number]
  /** Rondas de cada mapa jugado: nosotros y ellos. */
  scores: [number, number][]
  abandoned_by: "us" | "them" | null
}

/** backend: "nos falta 1". */
export type SubRequest = {
  id: string
  side: PcwSide
  need: number
  best_of: BestOf
  starts_at: string | null
  applicants: PcwPlayer[]
}

/** backend: "avisame si aparece una BO3 de mi nivel". */
export type PcwAlert = {
  id: string
  formats: BestOf[]
  myLevel: boolean
  asTeam: boolean
}

/** GET /servers/free?kind=pcw (libres) y la fila de la reserva. */
export type PcwServer = { name: string; free: boolean }

/** Resultado de una PCW jugada entre dos equipos (de GET /matches?kind=pcw). */
export type PcwResult = {
  id: string
  at: string
  a: PcwTeamRef
  b: PcwTeamRef
  /** Mapas ganados por a y por b. */
  score: [number, number]
}

export type TimeFilter = "all" | "now" | "today" | "later"
export type KindFilter = "all" | "team" | "mix"

export type PcwFilters = {
  bo: BestOf | null
  time: TimeFilter
  myLevel: boolean
  kind: KindFilter
}
