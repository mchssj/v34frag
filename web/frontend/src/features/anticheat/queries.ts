import { queryOptions } from "@tanstack/react-query"

import { unwrap } from "@/api/client"
import { authFetch } from "@/auth/authFetch"
import { env } from "@/lib/env"

// CMLeague Anticheat. Las rutas están en la rama kyan/anticheat-backend: hasta mezclarlas, schema.d.ts no las tiene
// y estos tipos van a mano. Al mezclar, regenerar con gen:api y usar `api` como el resto.

export type AcSession = {
  id: string
  player_id: string
  nick: string
  steam_id: string
  server_id: string
  server_name: string
  match_uid: string | null
  status: "open" | "closed" | "lost"
  started_at: string
  last_contact_at: string
  ended_at: string | null
  end_reason: string | null
  open_flags?: number
  max_severity?: number | null
}

export type AcEventKind =
  | "inventory"
  | "start"
  | "end"
  | "module"
  | "handle"
  | "overlay"
  | "driver"
  | "game_file"

// Marcas (replanteo 156): hechos para revisar, no conclusiones.
export type AcFlag = {
  id: number
  session_id?: string
  rule: string
  severity: 1 | 2 | 3
  detail: Record<string, unknown>
  created_at: string
  reviewed_at: string | null
  review_note: string | null
  nick?: string
  steam_id?: string
  server_name?: string
  started_at?: string
}

export type AcEvidence = {
  screenshots: {
    id: string
    kind: "auto" | "manual"
    method: string
    sha256: string
    size_bytes: number
    width: number
    height: number
    taken_at: string
    stored_at: string | null
    purged_at?: string | null
    url: string | null
  }[]
  processes: {
    kind: AcEventKind
    pid: number
    name: string
    path: string | null
    sha256: string | null
    signature: string | null
    publisher: string | null
    note: string | null
    observed_at: string
    detail?: Record<string, unknown> | null
  }[]
  requests: {
    id: string
    reason: string
    status: string
    created_at: string
  }[]
  flags?: AcFlag[]
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  return unwrap(
    (async () => {
      const response = await authFetch(`${env.apiUrl}${path}`, {
        ...init,
        headers: {
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
        },
      })
      const body: unknown =
        response.status === 204
          ? undefined
          : await response.json().catch(() => undefined)
      return response.ok
        ? { data: body as T, response }
        : { error: body, response }
    })()
  )
}

export const approveAgent = (userCode: string) =>
  call<{ device_name: string }>("/api/v1/me/anticheat/approve", {
    method: "POST",
    body: JSON.stringify({ user_code: userCode }),
  })

export const sessionsOptions = (status: AcSession["status"] | undefined) =>
  queryOptions({
    queryKey: ["admin", "anticheat", "sessions", status ?? "all"],
    queryFn: () =>
      call<{ items: AcSession[] }>(
        `/api/v1/admin/anticheat/sessions${status ? `?status=${status}` : ""}`
      ),
    refetchInterval: 15_000,
  })

export const evidenceOptions = (id: string) =>
  queryOptions({
    queryKey: ["admin", "anticheat", "evidence", id],
    queryFn: () => call<AcEvidence>(`/api/v1/admin/anticheat/sessions/${id}`),
    // Cada lectura queda registrada: solo se consulta sola mientras hay una captura pedida sin resolver.
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      query.state.data?.requests.some((r) => r.status === "pending")
        ? 5_000
        : false,
    staleTime: 240_000,
  })

export const requestCapture = (id: string, reason: string) =>
  call<{ id: string }>(`/api/v1/admin/anticheat/sessions/${id}/capture`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })

export type AcIntegrity = {
  result: "verified" | "failed" | "incomplete"
  checked: number
  problems: { seq: number | null; problem: string }[]
}

export const verifySession = (id: string) =>
  call<AcIntegrity>(`/api/v1/admin/anticheat/sessions/${id}/verify`, {
    method: "POST",
  })

export const holdSession = (id: string, held: boolean) =>
  call<undefined>(`/api/v1/admin/anticheat/sessions/${id}/hold`, {
    method: "POST",
    body: JSON.stringify({ held }),
  })

export const openMixes = (minutes: number) =>
  call<{ open_until: string | null }>("/api/v1/admin/anticheat/open", {
    method: "POST",
    body: JSON.stringify({ minutes }),
  })

// ---------- panel del staff (replanteos 156 y 157) ----------

export const flagsOptions = (open: boolean, minSeverity: number) =>
  queryOptions({
    queryKey: ["admin", "anticheat", "flags", open, minSeverity],
    queryFn: () =>
      call<{ items: AcFlag[] }>(
        `/api/v1/admin/anticheat/flags?open=${open}&min_severity=${minSeverity}&limit=100`
      ),
    refetchOnWindowFocus: false,
  })

export const reviewFlag = (id: number, note: string) =>
  call<undefined>(`/api/v1/admin/anticheat/flags/${id}/review`, {
    method: "POST",
    body: JSON.stringify(note.trim() ? { note: note.trim() } : {}),
  })

export type AcHashSearch = {
  players: number
  items: {
    player_id: string
    nick: string
    steam_id: string
    session_id: string
    kind: AcEventKind
    name: string
    path: string | null
    first_seen: string
    times: number
  }[]
  signature: AcSignature | null
}

export const hashSearch = (sha256: string) =>
  call<AcHashSearch>(`/api/v1/admin/anticheat/hash/${sha256}`)

export type AcSignature = {
  id: string
  sha256: string | null
  name: string | null
  kinds: AcEventKind[] | null
  verdict: "bad" | "good"
  label: string
  created_at: string
}

export const signaturesOptions = () =>
  queryOptions({
    queryKey: ["admin", "anticheat", "signatures"],
    queryFn: () => call<{ items: AcSignature[] }>("/api/v1/admin/anticheat/signatures"),
  })

export const addSignature = (s: {
  sha256?: string
  name?: string
  kinds?: AcEventKind[]
  verdict: "bad" | "good"
  label: string
}) =>
  call<{ id: string }>("/api/v1/admin/anticheat/signatures", {
    method: "POST",
    body: JSON.stringify(s),
  })

export const removeSignature = (id: string) =>
  call<undefined>(`/api/v1/admin/anticheat/signatures/${id}`, { method: "DELETE" })

export type AcAgentConfig = {
  agent_config: {
    handles?: boolean
    overlays?: boolean
    drivers?: boolean
    game_files?: boolean
    handles_every?: number
    overlays_every?: number
    modules_every?: number
    files?: string[]
  }
  agent_latest: { version: string; url: string; sha256: string } | null
  agent_min_version: string | null
  agent_hashes: string[]
  capture_min_s: number
  capture_max_s: number
  screenshot_retention_days: number
  retention_days: number
}

export const agentConfigOptions = () =>
  queryOptions({
    queryKey: ["admin", "anticheat", "config"],
    queryFn: () => call<AcAgentConfig>("/api/v1/admin/anticheat/config"),
  })

export const setAgentConfig = (patch: Partial<AcAgentConfig>) =>
  call<AcAgentConfig>("/api/v1/admin/anticheat/config", {
    method: "PATCH",
    body: JSON.stringify(patch),
  })

// ---------- servidores (replanteo 159) ----------

// off: no protege. always: desde que el jugador entra. mixes (con la partida en vivo) ya no se elige desde el 2026-11-27: solo
// llega en el listado si un servidor ya lo tenía.
export type AcServerMode = "off" | "mixes" | "always"
export type AcSettableMode = Exclude<AcServerMode, "mixes">

export type AcServerPolicy = {
  server_id: string
  name: string
  mode: AcServerMode
  // Toma salas: su modo lo decide "Anticheat obligatorio" de Administración › Matchmaking y no se cambia acá
  mm: boolean
  updated_at: string | null
}

export const serverPoliciesOptions = (q: { mode?: AcSettableMode; page: number }) =>
  queryOptions({
    queryKey: ["admin", "anticheat", "servers", q.mode ?? "all", q.page],
    queryFn: () =>
      call<{ items: AcServerPolicy[]; total: number; page: number; per: number }>(
        `/api/v1/admin/anticheat/servers?per=20&page=${q.page}&sort=name&order=asc${q.mode ? `&mode=${q.mode}` : ""}`
      ),
  })

export const setServerMode = (serverId: string, mode: AcSettableMode) =>
  call<AcServerPolicy>(`/api/v1/admin/anticheat/servers/${serverId}`, {
    method: "PUT",
    body: JSON.stringify({ mode }),
  })

export type AcMachine = {
  machine_id: string | null
  banned: boolean
  bans: { id: string; reason: string; created_at: string; lifted_at: string | null }[]
  accounts: { user_id: string; nick: string | null; steam_id: string | null; last_seen_at: string; evasion: boolean }[]
  attempts: { stage: string; ip: string | null; steam_id: string | null; created_at: string }[]
  exceptions: { user_id: string; nick: string | null; note: string | null; created_at: string }[]
}

export const machineOptions = (sessionId: string) =>
  queryOptions({
    queryKey: ["admin", "anticheat", "machine", sessionId],
    queryFn: () => call<AcMachine>(`/api/v1/admin/anticheat/sessions/${sessionId}/machine`),
    refetchOnWindowFocus: false,
  })

export const banMachine = (sessionId: string, reason: string) =>
  call<{ id: string }>(`/api/v1/admin/anticheat/sessions/${sessionId}/ban-machine`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })

export const liftMachineBan = (banId: string) =>
  call<undefined>(`/api/v1/admin/anticheat/machine-bans/${banId}/lift`, {
    method: "POST",
    body: JSON.stringify({}),
  })

export const addMachineException = (sessionId: string, userId: string, note: string) =>
  call<undefined>(`/api/v1/admin/anticheat/sessions/${sessionId}/machine-exception`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, ...(note.trim() ? { note: note.trim() } : {}) }),
  })