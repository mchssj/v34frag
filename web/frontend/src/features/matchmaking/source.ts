import { createContext, useContext } from "react"

import { authFetch } from "@/auth/authFetch"
import { errorFromResponse, networkError } from "@/api/errors"
import { env } from "@/lib/env"
import type {
  InvitePref,
  MapArt,
  MmAdminConfig,
  MmAdminLobby,
  MmAdminBan,
  MmAdminMap,
  MmAdminReport,
  MmAdminServer,
  MmCatalogMap,
  MmEvent,
  MmPasswordEntry,
  MmPlayerHit,
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
  join(mode: string, region: string | null): Promise<MmState>
  setInvitePref(pref: InvitePref): Promise<MmState>
  leave(): Promise<MmState>
  accept(): Promise<MmState>
  decline(): Promise<MmState>
  veto(map: string): Promise<MmState>
  sendChat(message: string, teamOnly: boolean): Promise<MmState>
  report(
    lobbyId: string,
    playerId: string,
    reason: ReportReason,
    note: string
  ): Promise<MmState>
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
  adminCatalog(signal?: AbortSignal): Promise<MmCatalogMap[]>
  /** El catálogo completo, en orden (no borra: un mapa se retira con `active: false`). */
  saveCatalog(maps: MmCatalogMap[]): Promise<MmCatalogMap[]>
  uploadMapArt(name: string, kind: MapArt, file: File): Promise<MmCatalogMap>
  removeMapArt(name: string, kind: MapArt): Promise<MmCatalogMap>
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
    join: (mode, region) => send("/api/v1/mm/queue", { mode, region }),
    // Privado o Público es una preferencia más de la cuenta (ruta que ya existe).
    setInvitePref: async (mm_invites) => {
      await send("/api/v1/me/profile", { preferences: { mm_invites } }, "PATCH")
      return call("/api/v1/mm/state")
    },
    leave: () => call("/api/v1/mm/queue", { method: "DELETE" }),
    accept: () => post("/api/v1/mm/lobby/accept"),
    decline: () => post("/api/v1/mm/lobby/decline"),
    veto: (map) => send("/api/v1/mm/lobby/veto", { map }),
    sendChat: (message, team_only) =>
      send("/api/v1/mm/lobby/chat", { message, team_only }),
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
    adminCatalog: async (signal) =>
      (
        await call<{ items: MmCatalogMap[] }>(
          "/api/v1/maps?include_inactive=true&per=100",
          { signal }
        )
      ).items,
    saveCatalog: async (maps) => {
      await send("/api/v1/admin/maps", { maps }, "PUT")
      return maps
    },
    uploadMapArt: (name, kind, file) => {
      const form = new FormData()
      form.append("file", file)
      return call(`/api/v1/admin/maps/${encodeURIComponent(name)}/${kind}`, {
        method: "POST",
        body: form,
      })
    },
    removeMapArt: (name, kind) =>
      call(`/api/v1/admin/maps/${encodeURIComponent(name)}/${kind}`, {
        method: "DELETE",
      }),
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
