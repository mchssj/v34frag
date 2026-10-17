// Valores fijos: la API todavía no los expone (ver "Pedidos al backend" en la bitácora
// 2026-10-16-frontend-diseno-landing-auth). Reemplazar por datos reales cuando existan.

export type GameServer = {
  name: string
  mode: string
  region: string
  /** host:puerto, para `connect` y `steam://connect/` */
  address: string
  online: boolean
  map: string | null
  players: number
  maxPlayers: number
  /** Texto ya formateado ("18 ms") o null si está fuera de línea */
  ping: string | null
}

export const SERVERS: GameServer[] = [
  {
    name: "CSSTV #1 · Mix",
    mode: "Mix 5v5",
    region: "Buenos Aires",
    address: "45.235.98.12:27015",
    online: true,
    map: "de_dust2",
    players: 10,
    maxPlayers: 10,
    ping: "18 ms",
  },
  {
    name: "CSSTV #2 · Liga",
    mode: "Torneo / PCW",
    region: "Buenos Aires",
    address: "45.235.98.13:27015",
    online: true,
    map: "de_inferno",
    players: 10,
    maxPlayers: 12,
    ping: "21 ms",
  },
  {
    name: "CSSTV #3 · DM",
    mode: "Deathmatch",
    region: "Santiago",
    address: "190.98.44.7:27015",
    online: true,
    map: "de_cbble",
    players: 17,
    maxPlayers: 24,
    ping: "42 ms",
  },
  {
    name: "CSSTV #4 · Retake",
    mode: "Retakes",
    region: "Santiago",
    address: "190.98.44.7:27016",
    online: false,
    map: null,
    players: 0,
    maxPlayers: 10,
    ping: null,
  },
]

/** Servidor que se indica para `!claim` en la Bienvenida. */
export const CLAIM_SERVER = SERVERS[0]

export const DISCORD = {
  inviteUrl: "https://discord.com",
  online: 214,
  members: 1386,
  channels: ["buscar-equipo", "pcw", "torneos", "soporte"],
}

/** Vigencia del link de confirmación (otp_expiry de Supabase Auth: 3600 s en la configuración local). */
export const CONFIRMATION_LINK_EXPIRY = "1 hora"
