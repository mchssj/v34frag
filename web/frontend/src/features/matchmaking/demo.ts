import { ApiError } from "@/api/errors"
import type { RoomPlayer } from "@/features/mixes/room"
import { REASON_TEXT, mapLabel } from "./labels"
import type { MmSource } from "./source"
import type {
  InvitePref,
  MapArt,
  MmAdminConfig,
  MmAdminBan,
  MmAdminLobby,
  MmAdminMap,
  MmAdminReport,
  MmAdminServer,
  MmCatalogMap,
  MmChatMessage,
  MmEvent,
  MmInvite,
  MmClip,
  MmCosmetics,
  MmLobby,
  MmMatch,
  MmParty,
  MmPasswordEntry,
  MmPlayer,
  MmPlayerHit,
  MmRecent,
  MmState,
  MmStatsDay,
} from "./types"

// Simulación en memoria para la demo (`/demo/matchmaking`) y las pruebas: recorre el dúo, la cola,
// la confirmación, el veto, el servidor y el mix sin API. No se usa con sesión real.

const BOTS: [string, number, number][] = [
  ["kz.flick", 10, 2140],
  ["nacho", 9, 1890],
  ["tincho_v34", 8, 1720],
  ["lauti", 8, 1690],
  ["rata", 7, 1580],
  ["bocha", 7, 1540],
  ["fede.awp", 6, 1460],
  ["pity", 6, 1420],
  ["gordo", 5, 1310],
]

/** Los que se pueden buscar para invitar al dúo. */
const FRIENDS: MmPlayerHit[] = [
  {
    player_id: "p-maxi",
    nick: "maxi",
    level: 8,
    elo: 1750,
    background_url: "/cosmetics/fondos/serie-luna-roja.svg",
    frame_url: "/cosmetics/marcos/serie-ninja.svg",
    name_class: "nombre-chakra",
    vip: true,
  },
  { player_id: "p-colo", nick: "colo", level: 6, elo: 1480 },
  { player_id: "p-juanchi", nick: "juanchi", level: 7, elo: 1600 },
  {
    player_id: "p-nico",
    nick: "nico.dlr",
    level: 10,
    elo: 2310,
    background_url: "/cosmetics/fondos/arma-oro.svg",
    frame_url: "/cosmetics/marcos/pais-br.svg",
    name_class: "nombre-pais-br",
  },
]

/** Los 9 mapas más jugados: el veto del 5v5 al empezar (plan, decisión "Mapas del 5v5"). */
export const DEMO_POOL = [
  "de_dust2",
  "de_inferno",
  "de_tuscan",
  "de_nuke",
  "de_season",
  "de_cbble",
  "de_cache",
  "de_train",
  "de_mirage",
]

/** Lo equipado en la tienda, como lo devolvería la API (rutas de public/cosmetics). */
const COS = "/cosmetics/"
const ME_COS: MmCosmetics = {
  background_url: COS + "fondos/neon.svg",
  frame_url: COS + "marcos/fuego.svg",
  name_class: "nombre-fuego",
  vip: true,
}
const ME = { player_id: "me", nick: "tu.nick", level: 8, elo: 1610, ...ME_COS }
const ME_CARD = {
  nick: ME.nick,
  country: "Argentina" as const,
  photo_url: null,
  elo: ME.elo,
  level: ME.level,
  ...ME_COS,
  recent: ["W", "W", "L", "W", "L"] as ("W" | "L")[],
}

const DEFAULT_CONFIG: MmAdminConfig = {
  open: true,
  modes: [
    { mode: "5v5", players_per_team: 5, enabled: true, affects_elo: true },
    { mode: "2v2", players_per_team: 2, enabled: true, affects_elo: false },
    { mode: "1v1", players_per_team: 1, enabled: false, affects_elo: false },
  ],
  max_party_size: 2,
  party_max_elo_gap: 500,
  accept_seconds: 20,
  veto_seconds: 15,
  connect_minutes: 5,
  server_wait_minutes: 3,
  elo_window_start: 150,
  elo_window_step: 50,
  elo_window_every_s: 30,
  elo_window_max: 600,
  elo_unlimited_after_s: 300,
  penalty_ladder: [5, 15, 60, 1440],
  reconnect_minutes: 3,
  min_mixes: 5,
  min_account_days: 7,
  season_queue_close_minutes: 15,
}

/** Mapas del veto de cada modo al empezar la demo. */
const DEFAULT_MODE_MAPS: Record<string, string[]> = {
  "5v5": DEMO_POOL,
  "2v2": ["de_dust2", "de_inferno", "aim_map", "fy_iceworld"],
  "1v1": ["aim_map", "awp_map", "fy_iceworld"],
}
// Catálogo inicial de la demo. Las imágenes son dibujos generados (demoArt); de_season no tiene
// fondo y de_cache no tiene imagen, para ver qué se muestra cuando falta cada una.
const DISPLAY: Record<string, string> = { de_cbble: "Cobblestone" }
function seedCatalog(): MmCatalogMap[] {
  return [
    ...DEMO_POOL,
    "de_aztec",
    "de_dust",
    "de_piranesi",
    "cs_office",
    "aim_map",
    "awp_map",
    "fy_iceworld",
  ].map((name, i) => ({
    name,
    display_name: DISPLAY[name] ?? null,
    versions: name === "de_inferno" ? [name, "de_inferno_classic"] : [name],
    active: name !== "de_piranesi",
    image_url: name === "de_cache" || i > 9 ? null : demoArt(name, "image"),
    background_url:
      name === "de_season" || i > 9 ? null : demoArt(name, "background"),
  }))
}

/** Imagen de ejemplo en SVG: un degradé con el nombre del mapa (la demo no tiene fotos). */
export function demoArt(name: string, kind: MapArt) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  const [w, hh] = kind === "image" ? [400, 300] : [1920, 1080]
  const label = mapLabel(name).toUpperCase()
  const size = kind === "image" ? 44 : 160
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},55%,42%)"/><stop offset="1" stop-color="hsl(${(h + 50) % 360},60%,14%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="56%" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${size}" fill="rgba(255,255,255,.22)">${label}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** Escenarios que la demo deja prender para ver cada aviso de Jugar. */
export type DemoFlag = "captain" | "newcomer" | "serversBusy" | "season"
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
const SECOND = 1000

export function randomPassword(len: number, random = Math.random) {
  let out = ""
  for (let i = 0; i < len; i++)
    out += ALPHABET[Math.floor(random() * ALPHABET.length)]
  return out
}

/** Regla de negocio rechazada, como la devolvería la API (409 BUSINESS_RULE). */
class DemoError extends ApiError {
  constructor(message: string) {
    super({ status: 409, code: "BUSINESS_RULE", message })
  }
}

export type DemoControls = {
  /** Adelanta a la fase siguiente. */
  skip(): void
  /** Otro jugador rechaza la confirmación. */
  someoneDeclines(): void
  /** Termina el mix en vivo (rota la contraseña del servidor). */
  finish(): void
  /** Llega una invitación al dúo de otro jugador. */
  receiveInvite(): void
  /** Un compañero de equipo se desconecta durante la partida. */
  teammateLeaves(): void
  /** El compañero del dúo sale del grupo (por su cuenta). */
  partnerLeavesParty(): void
  /** Prende o apaga un escenario (capitán, cuenta nueva, servidores ocupados, temporada). */
  setFlag(flag: DemoFlag, on: boolean): void
  reset(): void
}

export function createDemoSource({
  now = Date.now,
  random = Math.random,
  tickMs = 500,
}: { now?: () => number; random?: () => number; tickMs?: number } = {}): {
  source: MmSource
  controls: DemoControls
} {
  const listeners = new Set<(e: MmEvent) => void>()
  const iso = (ms: number) => new Date(ms).toISOString()
  let seq = 1
  const id = (p: string) => `${p}-${seq++}`

  let queueSize = 6
  let queue: MmState["queue"] = null
  let lobby: MmLobby | null = null
  let party: MmParty | null = null
  let invites: MmInvite[] = []
  let penalty: MmState["penalty"] = null
  const flags: Record<DemoFlag, boolean> = {
    captain: true,
    newcomer: false,
    serversBusy: false,
    season: false,
  }
  let reports: MmAdminReport[] = []
  let bans: MmAdminBan[] = []
  let invitesPref: InvitePref = "public"
  let config = structuredClone(DEFAULT_CONFIG)
  let modeMaps = structuredClone(DEFAULT_MODE_MAPS)
  let catalog = seedCatalog()
  const byName = (name: string) => catalog.find((m) => m.name === name)
  let teamSize = 5
  let lobbyCreatedAt = ""
  // Cuándo pasa sola a la fase siguiente; null = espera una acción.
  let phaseAt: number | null = null
  // Momentos en que cada bot acepta, se conecta o banea; y cuándo responde o entra el dúo.
  let botTimes = new Map<string, number>()
  let partyAt: { at: number; what: "accept" | "queue" } | null = null

  const history = new Map<string, MmPasswordEntry[]>()
  const servers: MmAdminServer[] = [
    {
      id: "srv-1",
      name: "CM League #1",
      address: "45.235.98.12:27062",
      state: "free",
      region: "Argentina",
      mm_enabled: true,
      password: null,
    },
    {
      id: "srv-2",
      name: "RBK",
      address: "131.196.198.40:27015",
      state: "free",
      region: "Chile",
      mm_enabled: false,
      password: null,
    },
  ]

  function addPassword(
    serverId: string,
    kind: MmPasswordEntry["kind"],
    setBy: string,
    applied: boolean,
    lobbyId: string | null = null,
    at = now()
  ) {
    const entry: MmPasswordEntry = {
      id: id("pw"),
      password: randomPassword(kind === "mix" ? 6 : 8, random),
      kind,
      lobby_id: lobbyId,
      set_by: setBy,
      created_at: iso(at),
      applied_at: applied ? iso(at) : null,
    }
    history.set(
      serverId,
      [entry, ...(history.get(serverId) ?? [])].slice(0, 50)
    )
    const srv = servers.find((s) => s.id === serverId)!
    if (applied) srv.password = entry
    return entry
  }

  function seedPasswords() {
    history.clear()
    const t = now()
    for (const s of servers) s.password = null
    addPassword("srv-1", "idle", "plugin", true, null, t - 26 * 3600_000)
    addPassword("srv-1", "mix", "plugin", true, "lob-old", t - 3 * 3600_000)
    addPassword("srv-1", "idle", "plugin", true, null, t - 2 * 3600_000)
    addPassword("srv-2", "idle", "system", true, null, t - 5 * 3600_000)
  }
  seedPasswords()

  function seedReports(): MmAdminReport[] {
    const t = now()
    return [
      {
        id: "rep-1",
        lobby_id: "lob-old",
        mode: "5v5",
        reporter: "nacho",
        reported: "gordo",
        reported_user_id: "p-gordo",
        reason: "afk",
        note: "No se movió de spawn en 6 rondas",
        created_at: iso(t - 50 * 60_000),
        status: "pending",
      },
      {
        id: "rep-2",
        lobby_id: "lob-old2",
        mode: "5v5",
        reporter: "lauti",
        reported: "pity",
        reported_user_id: "p-pity",
        reason: "toxic",
        note: null,
        created_at: iso(t - 26 * 3600_000),
        status: "warned",
      },
    ]
  }
  reports = seedReports()

  const emit = (t: string) => {
    for (const fn of listeners) fn({ t, lobby: lobby?.id })
  }

  const penalized = () => !!penalty && Date.parse(penalty.until) > now()
  const amLeader = () =>
    !party || party.members.some((m) => m.is_me && m.is_leader)
  const partner = () => party?.members.find((m) => !m.is_me) ?? null

  const player = (
    p: { player_id: string; nick: string; level: number; elo: number },
    isMe = false
  ): MmPlayer => ({
    ...p,
    photo_url: null,
    ...COS_OF[p.nick],
    country: COUNTRY_OF[p.nick] ?? "Argentina",
    elo_trend: trend(p.nick),
    recent: recentOf(p.nick, p.elo),
    team: 1,
    party_id: null,
    is_captain: false,
    accepted: false,
    connected: false,
    left_until: null,
    abandoned: false,
    is_me: isMe,
  })

  function newLobby(): MmLobby {
    const mate = partner()
    const bots = BOTS.filter(([nick]) => nick !== mate?.nick)
      .slice(0, teamSize * 2 - (mate ? 2 : 1))
      .map(([nick, level, elo]) =>
        player({ player_id: `p-${nick}`, nick, level, elo })
      )
    const all = [player(ME, true), ...(mate ? [player(mate)] : []), ...bots]
    if (party && mate) {
      all[0]!.party_id = party.id
      all[1]!.party_id = party.id
    }
    balance(all)
    const t = now()
    botTimes = new Map(
      all
        .filter((p) => !p.is_me)
        .map((p) => [p.player_id, t + (2 + random() * 10) * SECOND])
    )
    return {
      id: id("lob"),
      mode: queue?.mode ?? "5v5",
      region: queue?.region ?? "Argentina",
      match: null,
      status: "accepting",
      map: null,
      accept_deadline: iso(t + config.accept_seconds * SECOND),
      veto: null,
      connect_deadline: null,
      players: all,
      server: null,
      match_id: null,
      end_reason: null,
      chat: [],
      reported: [],
    }
  }

  function say(nick: string, message: string, team: 1 | 2 | null = null) {
    if (!lobby) return
    const msg: MmChatMessage = {
      id: id("msg"),
      nick,
      team,
      mine: nick === ME.nick,
      message,
      created_at: iso(now()),
    }
    lobby = { ...lobby, chat: [...lobby.chat, msg].slice(-100) }
    emit("lobby.chat")
  }

  // Serpiente por ELO y, si el dúo quedó separado, se cambia al compañero por el del propio equipo
  // con ELO más parecido. En la demo alcanza; el real prueba las 126 divisiones sin separar dúos.
  function balance(all: MmPlayer[]) {
    all
      .sort((a, b) => b.elo - a.elo)
      .forEach((p, i) => (p.team = [0, 3].includes(i % 4) ? 1 : 2))
    const me = all.find((p) => p.is_me)!
    const mate = all.find((p) => p.party_id && !p.is_me)
    if (!mate || mate.team === me.team) return
    const swap = all
      .filter((p) => p.team === me.team && !p.is_me)
      .sort(
        (a, b) => Math.abs(a.elo - mate.elo) - Math.abs(b.elo - mate.elo)
      )[0]!
    swap.team = mate.team
    mate.team = me.team
  }

  function startVeto() {
    if (!lobby) return
    const t = now()
    for (const team of [1, 2] as const) {
      const list = lobby.players.filter((p) => p.team === team)
      const me = list.find((p) => p.is_me)
      // Capitán: el de más ELO del equipo; en la demo se puede forzar que seas vos.
      const captain =
        me && flags.captain ? me : [...list].sort((a, b) => b.elo - a.elo)[0]!
      captain.is_captain = true
    }
    const avg = (team: 1 | 2) =>
      lobby!.players
        .filter((p) => p.team === team)
        .reduce((s, p) => s + p.elo, 0) / teamSize
    // Empieza el equipo con menor ELO promedio.
    const first = avg(1) <= avg(2) ? 1 : 2
    lobby = {
      ...lobby,
      status: "veto",
      veto: {
        pool: (modeMaps[lobby.mode] ?? DEMO_POOL).map((name) => ({
          name,
          label: mapLabel(name, byName(name)?.display_name),
          image_url: byName(name)?.image_url ?? null,
          background_url: byName(name)?.background_url ?? null,
        })),
        bans: [],
        turn: first,
        deadline: iso(t + config.veto_seconds * SECOND),
      },
    }
    scheduleBotBan()
    emit("lobby.veto")
    const rival = lobby.players.find((p) => p.is_captain && p.team !== myTeam())
    if (rival) say(rival.nick, "gl hf")
  }

  const myTeam = () => lobby?.players.find((p) => p.is_me)?.team
  const myTurn = () =>
    !!lobby?.veto?.turn &&
    lobby.veto.turn === myTeam() &&
    lobby.players.some((p) => p.is_me && p.is_captain)

  function scheduleBotBan() {
    botTimes = new Map([
      ["ban", myTurn() ? Infinity : now() + (2 + random() * 3) * SECOND],
    ])
  }

  function ban(map: string, auto: boolean) {
    const veto = lobby?.veto
    if (!lobby || !veto?.turn) return
    const left = remaining()
    if (!left.includes(map))
      throw new DemoError("Ese mapa ya no se puede banear")
    const bans = [
      ...veto.bans,
      { seq: veto.bans.length + 1, team: veto.turn, map, auto },
    ]
    const rest = left.filter((m) => m !== map)
    if (rest.length === 1) {
      lobby = {
        ...lobby,
        status: "waiting_server",
        map: rest[0]!,
        veto: { ...veto, bans, turn: null, deadline: null },
      }
      phaseAt = now() + 2 * SECOND
    } else {
      lobby = {
        ...lobby,
        veto: {
          ...veto,
          bans,
          turn: veto.turn === 1 ? 2 : 1,
          deadline: iso(now() + config.veto_seconds * SECOND),
        },
      }
      scheduleBotBan()
    }
    emit("lobby.veto")
  }

  const remaining = () => {
    const veto = lobby?.veto
    if (!veto) return []
    const banned = new Set(veto.bans.map((b) => b.map))
    return veto.pool.map((m) => m.name).filter((m) => !banned.has(m))
  }
  const randomMap = () => {
    const left = remaining()
    return left[Math.floor(random() * left.length)]!
  }

  function cancel(reason: string, backToQueue: boolean) {
    if (!lobby) return
    const accepted = lobby.players.find((p) => p.is_me)?.accepted
    lobby = { ...lobby, status: "cancelled", end_reason: reason }
    setServer("free")
    phaseAt = now() + 4 * SECOND
    // Los que aceptaron vuelven con su lugar original (joined_at no cambia).
    if (backToQueue && accepted && queue) queue = { ...queue, position: 1 }
    else queue = null
    emit("lobby.cancelled")
  }

  function setServer(state: MmAdminServer["state"]) {
    servers[0]!.state = state
  }

  function advance() {
    const t = now()
    if (queue && !lobby) {
      lobbyCreatedAt = iso(t)
      lobby = newLobby()
      phaseAt = null
      emit("lobby.found")
      return
    }
    if (!lobby) return
    switch (lobby.status) {
      case "accepting":
        lobby.players.forEach((p) => (p.accepted = true))
        startVeto()
        return
      case "veto":
        while (lobby.status === "veto") ban(randomMap(), true)
        return
      case "waiting_server": {
        const pw = addPassword("srv-1", "mix", "plugin", true, lobby.id)
        setServer("lobby")
        lobby = {
          ...lobby,
          status: "assigned",
          server: {
            name: servers[0]!.name,
            address: servers[0]!.address,
            password: pw.password,
          },
        }
        phaseAt = t + 2 * SECOND
        emit("lobby.server")
        return
      }
      case "assigned":
        lobby = {
          ...lobby,
          status: "connecting",
          connect_deadline: iso(t + 5 * 60 * SECOND),
        }
        botTimes = new Map(
          lobby.players.map((p, i) => [p.player_id, t + (i + 1) * 1500])
        )
        phaseAt = null
        emit("lobby.update")
        return
      case "connecting":
        lobby.players.forEach((p) => (p.connected = true))
        lobby = {
          ...lobby,
          status: "live",
          match_id: id("match"),
          match: matchSnapshot(lobby, false),
        }
        setServer("live")
        phaseAt = null
        emit("lobby.update")
        return
      case "live":
        finishMix()
        return
      case "finished":
      case "cancelled":
        lobby = null
        phaseAt = null
        emit("state")
        return
    }
  }

  function finishMix() {
    if (lobby?.status !== "live") return
    lobby = {
      ...lobby,
      status: "finished",
      end_reason: null,
      match: matchSnapshot(lobby, true),
    }
    queue = null
    // Lo que hace el plugin al terminar: una al azar, ya puesta, y la manda a la web.
    addPassword("srv-1", "idle", "plugin", true)
    setServer("free")
    phaseAt = now() + 6 * SECOND
    emit("lobby.finished")
  }

  function joinQueue(mode = "5v5", region: string | null = null) {
    teamSize = config.modes.find((m) => m.mode === mode)?.players_per_team ?? 5
    queue = {
      mode,
      region,
      joined_at: iso(now()),
      position: queueSize + 1,
      elo_window: config.elo_window_start,
    }
    emit("queue.changed")
  }

  function tickParty(t: number) {
    invites = invites.filter((i) => Date.parse(i.expires_at) > t)
    if (party?.pending && Date.parse(party.pending.expires_at) <= t) {
      party = party.members.length > 1 ? { ...party, pending: null } : null
      emit("party.changed")
    }
    if (!partyAt || partyAt.at > t) return
    const what = partyAt.what
    partyAt = null
    if (what === "accept" && party?.pending) {
      const friend = FRIENDS.find((f) => f.nick === party!.pending!.to_nick)!
      party = {
        ...party,
        members: [
          ...party.members,
          { ...friend, is_me: false, is_leader: false },
        ],
        pending: null,
      }
      emit("party.changed")
    } else if (what === "queue" && party && !amLeader() && !queue && !lobby) {
      // El líder (otro jugador) entra a la cola por los dos.
      joinQueue()
    }
  }

  function tick() {
    const t = now()
    tickParty(t)
    // Sin servidor libre no se arma la sala (plan, decisión "Pocos servidores").
    if (
      queue &&
      !lobby &&
      freeServers() > 0 &&
      t - Date.parse(queue.joined_at) > 8 * SECOND
    ) {
      advance()
      return
    }
    if (queue && !lobby && random() < 0.15) {
      queueSize = Math.max(
        1,
        Math.min(9, queueSize + (random() < 0.5 ? -1 : 1))
      )
      emit("queue.changed")
    }
    if (!lobby) return
    if (lobby.status === "accepting") {
      let changed = false
      for (const p of lobby.players) {
        if (!p.is_me && !p.accepted && botTimes.get(p.player_id)! <= t) {
          p.accepted = true
          changed = true
        }
      }
      if (lobby.players.every((p) => p.accepted)) return startVeto()
      if (Date.parse(lobby.accept_deadline!) <= t) {
        const meAccepted = lobby.players.find((p) => p.is_me)!.accepted
        if (!meAccepted) penalty = { until: iso(t + 5 * 60 * SECOND), level: 1 }
        return cancel(
          meAccepted
            ? "Un jugador no aceptó a tiempo"
            : "No aceptaste a tiempo",
          true
        )
      }
      if (changed) emit("lobby.accept")
      return
    }
    if (lobby.status === "veto") {
      const veto = lobby.veto!
      if (Date.parse(veto.deadline!) <= t) return ban(randomMap(), true)
      if (!myTurn() && botTimes.get("ban")! <= t) ban(randomMap(), false)
      return
    }
    if (lobby.status === "live") {
      for (const p of lobby.players) {
        if (p.left_until && Date.parse(p.left_until) <= t) {
          p.left_until = null
          p.abandoned = true
          emit("lobby.player")
        }
      }
    }
    if (lobby.status === "connecting") {
      let changed = false
      for (const p of lobby.players) {
        if (!p.connected && botTimes.get(p.player_id)! <= t) {
          p.connected = true
          changed = true
        }
      }
      if (lobby.players.every((p) => p.connected)) return advance()
      if (changed) emit("lobby.update")
      return
    }
    if (phaseAt !== null && phaseAt <= t) advance()
  }

  // Rotaciones pedidas por un admin: el "plugin" las pone en el próximo poll.
  function applyPending() {
    for (const s of servers) {
      const pending = history.get(s.id)?.find((e) => e.applied_at === null)
      if (pending && s.state === "free") {
        pending.applied_at = iso(now())
        s.password = pending
        emit("admin.password")
      }
    }
  }

  const freeServers = () =>
    flags.serversBusy
      ? 0
      : servers.filter((x) => x.mm_enabled && x.state === "free").length
  const banned = () => bans.find((b) => b.user_id === "me")

  const snapshot = (): MmState => ({
    open: config.open,
    me: structuredClone(ME_CARD),
    modes: config.modes.filter((m) => m.enabled),
    regions: ["Argentina", "Chile"],
    max_party_size: config.max_party_size,
    invites_pref: invitesPref,
    active_players: 131 + queueSize,
    live_matches: lobby?.status === "live" ? 4 : 3,
    queue_size: queueSize + (queue ? (party?.members.length ?? 1) : 0),
    queue: queue && {
      ...queue,
      elo_window: eloWindow(now() - Date.parse(queue.joined_at)),
    },
    lobby: lobby && structuredClone(lobby),
    party: party && structuredClone(party),
    invites: structuredClone(invites),
    penalty: penalized() ? penalty : null,
    ban: banned() ? { until: banned()!.until, reason: banned()!.reason } : null,
    newcomer: flags.newcomer ? { mixes_left: 2, days_left: 0 } : null,
    servers: {
      free: freeServers(),
      total: servers.filter((x) => x.mm_enabled).length,
    },
    season: flags.season
      ? {
          ends_at: iso(now() + 40 * 60 * SECOND),
          queue_closes_at: iso(
            now() + (40 - config.season_queue_close_minutes) * 60 * SECOND
          ),
        }
      : null,
    block_reason: flags.newcomer
      ? "Te faltan 2 mixes para jugar matchmaking"
      : null,
  })

  const source: MmSource = {
    async state() {
      return snapshot()
    },
    async join(mode, region) {
      if (penalized()) throw new DemoError("Tenés una sanción vigente")
      if (flags.newcomer)
        throw new DemoError("Te faltan 2 mixes para jugar matchmaking")
      if (!amLeader())
        throw new DemoError("Solo el líder del grupo entra a la cola")
      const size = config.modes.find(
        (m) => m.mode === mode && m.enabled
      )?.players_per_team
      if (!size) throw new DemoError("Ese modo no está habilitado")
      if ((party?.members.length ?? 1) > size)
        throw new DemoError(`Tu grupo no entra en un equipo de ${mode}`)
      joinQueue(mode, region)
      return snapshot()
    },
    async setInvitePref(pref) {
      invitesPref = pref
      if (pref === "private") invites = []
      emit("state")
      return snapshot()
    },
    async leave() {
      if (lobby?.status === "accepting") {
        penalty = { until: iso(now() + 5 * 60 * SECOND), level: 1 }
        cancel("Rechazaste la partida", false)
      }
      queue = null
      emit("queue.changed")
      return snapshot()
    },
    async accept() {
      const p = lobby?.players.find((x) => x.is_me)
      if (p) p.accepted = true
      emit("lobby.accept")
      tick()
      return snapshot()
    },
    async decline() {
      penalty = { until: iso(now() + 5 * 60 * SECOND), level: 1 }
      cancel("Rechazaste la partida", false)
      return snapshot()
    },
    async veto(map) {
      if (!myTurn()) throw new DemoError("No es tu turno de banear")
      ban(map, false)
      return snapshot()
    },
    async searchPlayers(q) {
      const term = q.trim().toLowerCase()
      return FRIENDS.filter(
        (f) => term && f.nick.includes(term) && f.nick !== partner()?.nick
      )
    },
    async invite(playerId) {
      const friend = FRIENDS.find((f) => f.player_id === playerId)
      if (!friend) throw new DemoError("Ese jugador no existe")
      if (queue || lobby) throw new DemoError("Primero salí de la cola")
      if (party && party.members.length >= party.max_size)
        throw new DemoError("Tu grupo ya está completo")
      if (Math.abs(friend.elo - ME.elo) > config.party_max_elo_gap)
        throw new DemoError(
          `La diferencia de ELO con ${friend.nick} es mayor a ${config.party_max_elo_gap}`
        )
      party = {
        id: party?.id ?? id("party"),
        members: party?.members ?? [{ ...ME, is_me: true, is_leader: true }],
        max_size: config.max_party_size,
        pending: { to_nick: friend.nick, expires_at: iso(now() + 60 * SECOND) },
      }
      partyAt = { at: now() + 3 * SECOND, what: "accept" }
      emit("party.changed")
      return snapshot()
    },
    async respondInvite(inviteId, accept) {
      const inv = invites.find((i) => i.id === inviteId)
      invites = invites.filter((i) => i.id !== inviteId)
      if (inv && accept) {
        queue = null
        party = {
          id: id("party"),
          members: [
            { ...inv.from, is_me: false, is_leader: true },
            { ...ME, is_me: true, is_leader: false },
          ],
          max_size: config.max_party_size,
          pending: null,
        }
        partyAt = { at: now() + 4 * SECOND, what: "queue" }
      }
      emit("party.changed")
      return snapshot()
    },
    async kickFromParty(playerId) {
      if (!party || !amLeader())
        throw new DemoError("Solo el líder puede sacar a alguien del grupo")
      if (lobby)
        throw new DemoError("No se puede cambiar el grupo durante una partida")
      party = {
        ...party,
        members: party.members.filter((m) => m.player_id !== playerId),
      }
      // Si queda uno solo, el grupo se borra; y el grupo sale de la cola.
      if (party.members.length < 2) party = null
      queue = null
      partyAt = null
      emit("party.changed")
      return snapshot()
    },
    async promoteInParty(playerId) {
      if (!party || !amLeader())
        throw new DemoError("Solo el líder puede pasar el liderazgo")
      if (!party.members.some((m) => m.player_id === playerId))
        throw new DemoError("Ese jugador no está en tu grupo")
      party = {
        ...party,
        members: party.members.map((m) => ({
          ...m,
          is_leader: m.player_id === playerId,
        })),
      }
      emit("party.changed")
      return snapshot()
    },
    async leaveParty() {
      if (lobby)
        throw new DemoError("No se puede salir del grupo durante una partida")
      party = null
      partyAt = null
      queue = null
      emit("party.changed")
      return snapshot()
    },
    async adminServers() {
      return structuredClone(servers)
    },
    async passwordHistory(serverId) {
      return structuredClone(history.get(serverId) ?? [])
    },
    async rotatePassword(serverId) {
      const srv = servers.find((s) => s.id === serverId)
      if (!srv || srv.state !== "free")
        throw new DemoError("Solo se rota con el servidor libre")
      const entry = addPassword(serverId, "idle", "admin", false)
      emit("admin.password")
      setTimeout(applyPending, 3 * SECOND)
      return structuredClone(entry)
    },
    async adminConfig() {
      return structuredClone(config)
    },
    async saveConfig(next) {
      if (!next.modes.some((m) => m.enabled))
        throw new DemoError("Tiene que quedar al menos un modo habilitado")
      config = structuredClone(next)
      emit("mm.config")
      return structuredClone(config)
    },
    async sendChat(message, teamOnly) {
      const text = message.trim().slice(0, 200)
      if (!lobby || !text) throw new DemoError("No hay sala activa")
      say(ME.nick, text, teamOnly ? (myTeam() ?? null) : null)
      return snapshot()
    },
    async report(lobbyId, playerId, reason, note) {
      const target = lobby?.players.find((x) => x.player_id === playerId)
      if (!lobby || lobby.id !== lobbyId || !target)
        throw new DemoError("Solo se reporta a alguien de tu sala")
      if (lobby.reported.includes(playerId))
        throw new DemoError(`Ya reportaste a ${target.nick} en esta sala`)
      lobby = { ...lobby, reported: [...lobby.reported, playerId] }
      reports = [
        {
          id: id("rep"),
          lobby_id: lobby.id,
          mode: lobby.mode,
          reporter: ME.nick,
          reported: target.nick,
          reported_user_id: playerId,
          reason,
          note: note.trim() || null,
          created_at: iso(now()),
          status: "pending",
        },
        ...reports,
      ]
      emit("state")
      return snapshot()
    },
    async adminMaps(mode) {
      return adminMapList(mode)
    },
    async saveMaps(mode, names) {
      if (names.length < 2)
        throw new DemoError("El veto necesita al menos 2 mapas")
      modeMaps = { ...modeMaps, [mode]: [...names] }
      return adminMapList(mode)
    },
    async adminReports() {
      return structuredClone(reports)
    },
    async resolveReport(reportId, action, days = 3) {
      const rep = reports.find((x) => x.id === reportId)
      if (!rep) throw new DemoError("Ese reporte no existe")
      rep.status =
        action === "dismiss"
          ? "dismissed"
          : action === "warn"
            ? "warned"
            : "banned"
      if (action === "ban")
        bans = [
          ...bans.filter((b) => b.user_id !== rep.reported_user_id),
          {
            user_id: rep.reported_user_id,
            nick: rep.reported,
            until: iso(now() + days * 24 * 3600_000),
            reason: REASON_TEXT[rep.reason],
          },
        ]
    },
    async adminBans() {
      return structuredClone(bans)
    },
    async unban(userId) {
      bans = bans.filter((b) => b.user_id !== userId)
    },
    async adminStats(days) {
      return demoStats(days, now())
    },
    async setServerEnabled(serverId, enabled) {
      const srv = servers.find((x) => x.id === serverId)
      if (!srv) throw new DemoError("Ese servidor no existe")
      srv.mm_enabled = enabled
      return structuredClone(srv)
    },
    async adminCatalog() {
      return structuredClone(catalog)
    },
    async saveCatalog(next) {
      const names = new Set(next.map((m) => m.name))
      if (catalog.some((m) => !names.has(m.name)))
        throw new DemoError("Un mapa no se borra: retiralo")
      if (names.size !== next.length)
        throw new DemoError("Hay dos mapas con el mismo nombre")
      const bad = next.find((m) => !/^[a-z0-9_]{3,32}$/.test(m.name))
      if (bad)
        throw new DemoError(`"${bad.name}" no es un nombre de mapa válido`)
      // Un mapa retirado sale del veto de todos los modos.
      const retired = new Set(next.filter((m) => !m.active).map((m) => m.name))
      for (const mode of Object.keys(modeMaps))
        modeMaps[mode] = modeMaps[mode]!.filter((m) => !retired.has(m))
      catalog = structuredClone(next)
      return structuredClone(catalog)
    },
    async uploadMapArt(name, kind, file) {
      const map = byName(name)
      if (!map) throw new DemoError("Ese mapa no existe")
      const max = kind === "image" ? 2 : 4
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new DemoError("Tiene que ser JPEG, PNG o WebP")
      if (file.size > max * 1024 * 1024)
        throw new DemoError(`Pesa más de ${max} MB`)
      const url =
        typeof URL.createObjectURL === "function"
          ? URL.createObjectURL(file)
          : `blob:demo/${file.name}`
      if (kind === "image") map.image_url = url
      else map.background_url = url
      return structuredClone(map)
    },
    async removeMapArt(name, kind) {
      const map = byName(name)
      if (!map) throw new DemoError("Ese mapa no existe")
      if (kind === "image") map.image_url = null
      else map.background_url = null
      return structuredClone(map)
    },
    async adminLobbies() {
      const list: MmAdminLobby[] = []
      if (lobby && !["finished", "cancelled"].includes(lobby.status))
        list.push({
          id: lobby.id,
          mode: lobby.mode,
          status: lobby.status,
          map: lobby.map,
          server: lobby.server?.name ?? null,
          players: lobby.players.length,
          created_at: lobbyCreatedAt,
        })
      return list
    },
    async cancelLobby(lobbyId) {
      if (lobby?.id === lobbyId) cancel("Cancelada por un admin", false)
    },
    subscribe(onEvent, onStatus) {
      listeners.add(onEvent)
      const timer = setInterval(tick, tickMs)
      queueMicrotask(() => {
        onStatus(true)
        onEvent({ t: "ready" })
      })
      return () => {
        listeners.delete(onEvent)
        clearInterval(timer)
      }
    },
  }

  // Primero los del veto del modo (en su orden) y después el resto del catálogo.
  function adminMapList(mode: string): MmAdminMap[] {
    const chosen = modeMaps[mode] ?? []
    const rest = catalog
      .filter((m) => m.active && !chosen.includes(m.name))
      .map((m) => m.name)
    const row = (name: string, in_mm: boolean): MmAdminMap => ({
      name,
      label: mapLabel(name, byName(name)?.display_name),
      image_url: byName(name)?.image_url ?? null,
      in_mm,
    })
    return [
      ...chosen.map((name) => row(name, true)),
      ...rest.map((name) => row(name, false)),
    ]
  }

  const controls: DemoControls = {
    skip: advance,
    someoneDeclines() {
      if (lobby?.status === "accepting")
        cancel("Un jugador no aceptó a tiempo", true)
    },
    finish: finishMix,
    receiveInvite() {
      // Con invitaciones en Privado no le llega nada, como en la API.
      if (invitesPref === "private") return
      const from = FRIENDS[1]!
      invites = [
        ...invites.filter((i) => i.from.nick !== from.nick),
        { id: id("inv"), from, expires_at: iso(now() + 60 * SECOND) },
      ]
      emit("party.invite")
    },
    partnerLeavesParty() {
      if (!party) return
      party = null
      queue = null
      partyAt = null
      emit("party.changed")
    },
    teammateLeaves() {
      if (lobby?.status !== "live") return
      const mate = lobby.players.find(
        (x) => x.team === myTeam() && !x.is_me && !x.left_until && !x.abandoned
      )
      if (!mate) return
      mate.left_until = iso(now() + config.reconnect_minutes * 60 * SECOND)
      emit("lobby.player")
    },
    setFlag(flag, on) {
      flags[flag] = on
      emit("state")
    },
    reset() {
      queue = null
      lobby = null
      party = null
      invites = []
      penalty = null
      phaseAt = null
      partyAt = null
      config = structuredClone(DEFAULT_CONFIG)
      modeMaps = structuredClone(DEFAULT_MODE_MAPS)
      catalog = seedCatalog()
      reports = seedReports()
      bans = []
      invitesPref = "public"
      queueSize = 6
      servers.forEach((s) => (s.state = "free"))
      seedPasswords()
      emit("state")
    },
  }

  return { source, controls }
}

/** Ventana de ELO según la espera (valores por defecto de `mm_config`). */
export function eloWindow(waitedMs: number): number | null {
  const s = waitedMs / 1000
  if (s >= 300) return null
  return Math.min(600, 150 + Math.floor(s / 30) * 50)
}

/** Métricas inventadas pero estables (el mismo día da los mismos números). */
export function demoStats(days: number, now: number): MmStatsDay[] {
  const out: MmStatsDay[] = []
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(now - d * 24 * 3600_000).toISOString().slice(0, 10)
    const k = Number(day.slice(8, 10))
    for (const mode of ["5v5", "2v2"]) {
      const big = mode === "5v5"
      const lobbies = big ? 8 + (k % 7) : 3 + (k % 3)
      const cancelled = {
        no_accept: 1 + (k % 3),
        no_connect: k % 2,
        admin: k % 5 === 0 ? 1 : 0,
      }
      const lost = cancelled.no_accept + cancelled.no_connect + cancelled.admin
      out.push({
        day,
        mode,
        lobbies,
        played: Math.max(0, lobbies - lost),
        cancelled,
        avg_wait_s: big ? 95 + (k % 9) * 12 : 40 + (k % 5) * 8,
        p90_wait_s: big ? 240 + (k % 6) * 25 : 110 + (k % 4) * 15,
        avg_elo_diff: big ? 18 + (k % 8) * 4 : 30 + (k % 6) * 5,
        abandons: k % 4 === 0 ? 1 : 0,
      })
    }
  }
  return out
}

/** Algunos rivales con cosméticos, para ver cómo quedan en la sala. */
const COS_OF: Record<string, MmCosmetics> = {
  "kz.flick": {
    frame_url: COS + "marcos/arma-awp.svg",
    name_class: "nombre-arma-awp",
    vip: true,
  },
  nacho: {
    frame_url: COS + "marcos/pais-ar.svg",
    name_class: "nombre-pais-ar",
  },
  rata: { frame_url: COS + "marcos/c4.svg" },
}

const COUNTRY_OF: Record<string, MmPlayer["country"]> = {
  rata: "Chile",
  bocha: "Uruguay",
  "fede.awp": "Paraguay",
}

/** Número estable a partir de un texto (para que la demo dé siempre lo mismo). */
function seed(text: string) {
  let h = 7
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 9973
  return h
}

function trend(nick: string) {
  const h = seed(nick)
  return (h % 2 ? 1 : -1) * (12 + (h % 18))
}

function recentOf(nick: string, elo: number): MmRecent {
  const h = seed(nick)
  const kd = Math.round((0.7 + (elo - 1300) / 1600 + (h % 10) / 50) * 100) / 100
  const k = 14 + (h % 7)
  return {
    matches: 120 + (h % 900),
    win_pct: 42 + (h % 20),
    rating: Math.round((0.85 + kd / 4) * 100) / 100,
    k,
    d: Math.max(8, Math.round(k / kd)),
    a: 3 + (h % 4),
    kd,
    kr: Math.round((0.55 + (h % 30) / 100) * 100) / 100,
    adr: 62 + (h % 30),
  }
}

/**
 * Estadísticas de la partida para la sala: en vivo, una foto a mitad de partida; al terminar, el
 * resultado (13 a 7 para el equipo A) con sus clips.
 */
function matchSnapshot(lobby: MmLobby, finished: boolean): MmMatch {
  const [s1, s2] = finished ? [13, 7] : [7, 5]
  const rounds = s1 + s2
  const stats: RoomPlayer[] = lobby.players.map((p, i) => {
    const h = seed(p.nick)
    const won = p.team === 1
    const k = Math.round(rounds * (0.55 + (h % 40) / 100) * (won ? 1.1 : 0.85))
    const d = Math.max(
      4,
      Math.round(rounds * (0.45 + ((h >> 3) % 30) / 100) * (won ? 0.85 : 1.1))
    )
    const hsKills = Math.round(k * (0.35 + (h % 25) / 100))
    return {
      key: p.player_id,
      nick: p.nick,
      alias: p.nick,
      guest: false,
      mvp: false,
      me: p.is_me,
      k,
      d,
      a: 1 + (h % 7),
      hs: k ? Math.round((hsKills / k) * 100) : null,
      hsKills,
      adr: 55 + (h % 55) + (won ? 8 : 0),
      rounds,
      k2: 1 + (h % 5),
      k3: h % 3,
      k4: i === 0 ? 1 : 0,
      k5: 0,
      fk: 1 + (h % 5),
      fd: 1 + ((h >> 2) % 4),
      plants: p.team === 1 ? h % 3 : 0,
      defuses: p.team === 2 ? h % 2 : 0,
      clutches: finished ? [h % 2, (h >> 1) % 2, 0, 0, 0] : null,
      rating:
        Math.round((0.6 + k / rounds - d / rounds / 2 + (h % 20) / 100) * 100) /
        100,
      delta: finished ? (won ? 18 + (h % 9) : -(16 + (h % 8))) : null,
    }
  })
  // MVP: el de mejor rating del equipo ganador.
  if (finished) {
    const best = stats
      .filter(
        (x) => lobby.players.find((p) => p.player_id === x.key)?.team === 1
      )
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]
    if (best) best.mvp = true
  }
  const by = (nick: string) => lobby.players.find((p) => p.nick === nick)
  const clip = (
    n: number,
    who: MmPlayer | undefined,
    type: string,
    kills: number,
    round: number,
    status: MmClip["video"]["status"] = "done"
  ): MmClip => ({
    id: `clip-${n}`,
    type,
    round,
    player_id: who?.player_id ?? null,
    nick: who?.nick ?? "?",
    kills,
    video: {
      status,
      url: null,
      embed_url: null,
      seconds: status === "done" ? 18 : null,
    },
  })
  const team1 = lobby.players.filter((p) => p.team === 1)
  const team2 = lobby.players.filter((p) => p.team === 2)
  return {
    score1: s1,
    score2: s2,
    halves: finished
      ? [
          [6, 6],
          [7, 1],
        ]
      : [
          [6, 6],
          [1, 0],
        ],
    rounds,
    winner: finished ? 1 : null,
    played_at: new Date().toISOString(),
    demo_url: finished ? "https://demos.example/demo.dem" : null,
    stats,
    clips: finished
      ? [
          clip(1, team1[0] ?? by("kz.flick"), "4k", 4, 9),
          clip(2, team2[0], "clutch_3", 2, 14),
          clip(3, team1[1], "3k", 3, 4),
          clip(4, team2[1], "3k", 3, 17),
          clip(5, team1[2], "clutch_1", 1, 19, "processing"),
        ]
      : [],
  }
}
