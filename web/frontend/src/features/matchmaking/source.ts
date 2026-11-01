import { createContext, useContext } from "react"

import { authFetch } from "@/auth/authFetch"
import { errorFromResponse, networkError } from "@/api/errors"
import type { Schemas } from "@/api/client"
import { mapImage, type MapEntry } from "@/features/maps/queries"
import { env } from "@/lib/env"
import type {
  InvitePref,
  MmAdminConfig,
  MmAdminLobby,
  MmAdminBan,
  MmAdminMap,
  MmAdminReport,
  MmAdminServer,
  MmChatMessage,
  MmEvent,
  MmFeed,
  MmPasswordEntry,
  MmPlayerHit,
  MmSound,
  MmState,
  MmStatsDay,
  ReportReason,
} from "./types"

/**
 * De dónde salen los datos del matchmaking. La página no sabe si habla con la API o con la demo.
 * `subscribe` es el socket: avisa que algo cambió y devuelve cómo cortar.
 */
export type MmSource = {
  state(signal?: AbortSignal): Promise<MmState>
  feed(signal?: AbortSignal): Promise<MmFeed>
  join(mode: string, region: string | null): Promise<MmState>
  setInvitePref(pref: InvitePref): Promise<MmState>
  leave(): Promise<MmState>
  accept(): Promise<MmState>
  decline(): Promise<MmState>
  veto(matchId: string, map: string): Promise<MmState>
  chat(matchId: string, signal?: AbortSignal): Promise<MmChatMessage[]>
  sendChat(matchId: string, message: string, teamOnly: boolean): Promise<void>
  report(
    lobbyId: string,
    playerId: string,
    reason: ReportReason,
    note: string
  ): Promise<MmState>
  commend(lobbyId: string, playerId: string): Promise<MmState>
  block(playerId: string): Promise<MmState>
  unblock(playerId: string): Promise<MmState>
  setSound(soundId: string | null): Promise<MmState>
  /** Solo VIP. */
  uploadMySound(file: File): Promise<MmState>
  deleteMySound(): Promise<MmState>
  adminSounds(signal?: AbortSignal): Promise<MmSound[]>
  uploadSound(name: string, file: File): Promise<MmSound>
  deleteSound(soundId: string): Promise<void>
  addFriend(playerId: string): Promise<MmState>
  removeFriend(playerId: string): Promise<MmState>
  searchPlayers(q: string, signal?: AbortSignal): Promise<MmPlayerHit[]>
  invite(playerId: string): Promise<MmState>
  respondInvite(inviteId: string, accept: boolean): Promise<MmState>
  leaveParty(): Promise<MmState>
  /** Solo el líder: saca a otro del grupo. */
  kickFromParty(playerId: string): Promise<MmState>
  /** Solo el líder: le pasa el liderazgo a otro del grupo. */
  promoteInParty(playerId: string): Promise<MmState>
  adminServers(signal?: AbortSignal): Promise<MmAdminServer[]>
  passwordHistory(
    serverId: string,
    signal?: AbortSignal
  ): Promise<MmPasswordEntry[]>
  rotatePassword(serverId: string): Promise<MmPasswordEntry>
  adminConfig(signal?: AbortSignal): Promise<MmAdminConfig>
  saveConfig(config: MmAdminConfig): Promise<MmAdminConfig>
  adminMaps(mode: string, signal?: AbortSignal): Promise<MmAdminMap[]>
  /** Los mapas del veto de ese modo, en orden. */
  saveMaps(mode: string, names: string[]): Promise<MmAdminMap[]>
  adminReports(signal?: AbortSignal): Promise<MmAdminReport[]>
  resolveReport(
    reportId: string,
    action: "dismiss" | "warn" | "ban",
    days?: number
  ): Promise<void>
  adminBans(signal?: AbortSignal): Promise<MmAdminBan[]>
  unban(userId: string): Promise<void>
  adminStats(days: number, signal?: AbortSignal): Promise<MmStatsDay[]>
  setServerEnabled(serverId: string, enabled: boolean): Promise<MmAdminServer>
  adminLobbies(signal?: AbortSignal): Promise<MmAdminLobby[]>
  cancelLobby(lobbyId: string): Promise<void>
  subscribe(
    onEvent: (e: MmEvent) => void,
    onStatus: (up: boolean) => void
  ): () => void
}

// Las rutas todavía no están en la OpenAPI: se llama con authFetch directo. Al existir, se pasa a
// `api.GET(...)` con `unwrap`, como el resto de las features.
async function call<T>(
  path: string,
  init?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  let res: Response
  try {
    res = await authFetch(`${env.apiUrl}${path}`, init)
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e
    throw networkError()
  }
  const body: unknown = await res.json().catch(() => undefined)
  if (!res.ok) throw errorFromResponse(res, body)
  return body as T
}

const post = <T>(path: string) => call<T>(path, { method: "POST" })
const send = <T>(path: string, body: unknown, method = "POST") =>
  call<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

export function createApiSource(openSocket: MmSocketFactory): MmSource {
  return {
    state: (signal) => call("/api/v1/mm/state", { signal }),
    // Rutas que ya existen. Cada una puede fallar sola (sin sesión no hay "mis partidas").
    feed: async (signal) => {
      const get = <T>(path: string) =>
        call<{ items: T[] }>(path, { signal })
          .then((r) => r.items)
          .catch(() => [] as T[])
      const [live, mine, top, maps] = await Promise.all([
        get<Schemas["LiveMixSummary"]>("/api/v1/mixes/live?per=4"),
        get<Schemas["PlayerMatch"]>("/api/v1/me/matches?per=5"),
        get<Schemas["RankingPlayer"]>("/api/v1/ranking/players?per=5"),
        get<MapEntry>("/api/v1/maps?include_inactive=true&per=100"),
      ])
      return {
        // La jugada de la semana todavía no tiene ruta.
        highlight: null,
        live: live.map((m) => ({
          uid: m.uid,
          map: m.map,
          image_url: mapImage(maps, m.map),
          side1_name: m.side1.name ?? "Equipo A",
          side2_name: m.side2.name ?? "Equipo B",
          score1: m.side1.score ?? 0,
          score2: m.side2.score ?? 0,
          round: m.rounds_played,
        })),
        recent: mine.map((m) => ({
          match_id: m.match_id,
          map: m.map,
          image_url: mapImage(maps, m.map),
          won: m.won === true,
          score: `${m.score1 ?? 0} : ${m.score2 ?? 0}`,
          kills: m.kills ?? 0,
          deaths: m.deaths ?? 0,
          rating: m.rating,
          elo_delta: m.elo_delta,
        })),
        top: top.map((p) => ({
          position: p.position,
          nick: p.player.alias,
          photo_url: p.player.photo_url,
          elo: p.elo,
          level: p.level ?? 1,
        })),
      }
    },
    join: (mode, region) => send("/api/v1/mm/queue", { mode, region }),
    // Privado o Público es una preferencia más de la cuenta (ruta que ya existe).
    setInvitePref: async (mm_invites) => {
      await send("/api/v1/me/profile", { preferences: { mm_invites } }, "PATCH")
      return call("/api/v1/mm/state")
    },
    leave: () => call("/api/v1/mm/queue", { method: "DELETE" }),
    accept: () => post("/api/v1/mm/lobby/accept"),
    decline: () => post("/api/v1/mm/lobby/decline"),
    // Veto y chat: las rutas de partida que ya existen (la partida se crea al empezar el veto).
    veto: async (matchId, map) => {
      await send(`/api/v1/matches/${encodeURIComponent(matchId)}/veto`, { map })
      return call("/api/v1/mm/state")
    },
    chat: async (matchId, signal) =>
      (
        await call<{
          items: {
            id: number
            alias: string
            message: string
            created_at: string
            side?: 1 | 2 | null
          }[]
        }>(`/api/v1/matches/${encodeURIComponent(matchId)}/chat`, { signal })
      ).items.map((m) => ({
        id: String(m.id),
        nick: m.alias,
        team: m.side ?? null,
        message: m.message,
        created_at: m.created_at,
      })),
    sendChat: async (matchId, message, teamOnly) => {
      await send(`/api/v1/matches/${encodeURIComponent(matchId)}/chat`, {
        message,
        team_only: teamOnly,
      })
    },
    report: (lobby_id, player_id, reason, note) =>
      send("/api/v1/mm/reports", { lobby_id, player_id, reason, note }),
    // Usa la búsqueda de jugadores que ya existe; el backend filtra a quién se puede invitar.
    // Búsqueda de jugadores que ya existe; mm_party_invite valida si se lo puede invitar.
    searchPlayers: async (q, signal) =>
      (
        await call<{
          items: {
            id: string
            alias: string
            elo: number | null
            level: number | null
          }[]
        }>(`/api/v1/players?q=${encodeURIComponent(q)}&per=10`, { signal })
      ).items.map((p) => ({
        player_id: p.id,
        nick: p.alias,
        elo: p.elo ?? 0,
        level: p.level ?? 1,
      })),
    commend: (lobby_id, player_id) =>
      send("/api/v1/mm/commends", { lobby_id, player_id }),
    setSound: (sound_id) =>
      send("/api/v1/mm/sounds/selected", { sound_id }, "PUT"),
    uploadMySound: (file) => {
      const body = new FormData()
      body.set("file", file)
      return call("/api/v1/mm/sounds/mine", { method: "POST", body })
    },
    deleteMySound: () => call("/api/v1/mm/sounds/mine", { method: "DELETE" }),
    adminSounds: (signal) =>
      call<{ items: MmSound[] }>("/api/v1/admin/mm/sounds", { signal }).then(
        (r) => r.items
      ),
    uploadSound: (name, file) => {
      const body = new FormData()
      body.set("name", name)
      body.set("file", file)
      return call("/api/v1/admin/mm/sounds", { method: "POST", body })
    },
    deleteSound: (id) =>
      call(`/api/v1/admin/mm/sounds/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    addFriend: (player_id) => send("/api/v1/mm/friends", { player_id }),
    removeFriend: (id) =>
      call(`/api/v1/mm/friends/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    block: (player_id) => send("/api/v1/mm/blocks", { player_id }),
    unblock: (id) =>
      call(`/api/v1/mm/blocks/${encodeURIComponent(id)}`, { method: "DELETE" }),
    invite: (player_id) => send("/api/v1/mm/party/invites", { player_id }),
    respondInvite: (id, accept) =>
      post(
        `/api/v1/mm/party/invites/${encodeURIComponent(id)}/${accept ? "accept" : "decline"}`
      ),
    leaveParty: () => call("/api/v1/mm/party", { method: "DELETE" }),
    kickFromParty: (id) =>
      call(`/api/v1/mm/party/members/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    promoteInParty: (player_id) =>
      send("/api/v1/mm/party/leader", { player_id }),
    adminServers: (signal) => call("/api/v1/admin/mm/servers", { signal }),
    passwordHistory: (id, signal) =>
      call(`/api/v1/admin/mm/servers/${encodeURIComponent(id)}/passwords`, {
        signal,
      }),
    rotatePassword: (id) =>
      post(`/api/v1/admin/mm/servers/${encodeURIComponent(id)}/password`),
    adminConfig: (signal) => call("/api/v1/admin/mm/config", { signal }),
    saveConfig: (config) => send("/api/v1/admin/mm/config", config, "PATCH"),
    adminMaps: (mode, signal) =>
      call(`/api/v1/admin/mm/maps/${encodeURIComponent(mode)}`, { signal }),
    saveMaps: (mode, maps) =>
      send(
        `/api/v1/admin/mm/maps/${encodeURIComponent(mode)}`,
        { maps },
        "PUT"
      ),
    adminReports: (signal) => call("/api/v1/admin/mm/reports", { signal }),
    resolveReport: (id, action, days) =>
      send(`/api/v1/admin/mm/reports/${encodeURIComponent(id)}/resolve`, {
        action,
        days,
      }),
    adminBans: (signal) => call("/api/v1/admin/mm/bans", { signal }),
    unban: (user) =>
      call(`/api/v1/admin/mm/bans/${encodeURIComponent(user)}`, {
        method: "DELETE",
      }),
    adminStats: (days, signal) =>
      call(`/api/v1/admin/mm/stats?days=${days}`, { signal }),
    setServerEnabled: (id, mm_enabled) =>
      // `mm_enabled` es un campo más del PATCH de servidores que ya existe.
      send(
        `/api/v1/admin/servers/${encodeURIComponent(id)}`,
        { mm_enabled },
        "PATCH"
      ),
    adminLobbies: (signal) => call("/api/v1/admin/mm/lobbies", { signal }),
    cancelLobby: (id) =>
      post(`/api/v1/admin/mm/lobbies/${encodeURIComponent(id)}/cancel`),
    subscribe: openSocket,
  }
}

export type MmSocketFactory = MmSource["subscribe"]

export const MmSourceContext = createContext<MmSource | null>(null)

export function useMmSource(): MmSource {
  const source = useContext(MmSourceContext)
  if (!source) throw new Error("Falta MmSourceContext")
  return source
}
