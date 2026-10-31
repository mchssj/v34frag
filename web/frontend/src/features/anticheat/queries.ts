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
    url: string | null
  }[]
  processes: {
    kind: "inventory" | "start" | "end"
    pid: number
    name: string
    path: string | null
    sha256: string | null
    signature: string | null
    publisher: string | null
    note: string | null
    observed_at: string
  }[]
  requests: {
    id: string
    reason: string
    status: string
    created_at: string
  }[]
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
    // Cada lectura queda registrada: no se consulta sola. Las URL de las capturas duran 5 minutos.
    refetchOnWindowFocus: false,
    staleTime: 240_000,
  })

export const requestCapture = (id: string, reason: string) =>
  call<{ id: string }>(`/api/v1/admin/anticheat/sessions/${id}/capture`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })

export const openMixes = (minutes: number) =>
  call<{ open_until: string | null }>("/api/v1/admin/anticheat/open", {
    method: "POST",
    body: JSON.stringify({ minutes }),
  })
