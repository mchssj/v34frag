import { errorFromResponse, networkError } from "@/api/errors"
import { env } from "@/lib/env"
import {
  toSession,
  tokenStore,
  type ApiSession,
  type Session,
  type TokenStore,
} from "./tokenStore"

/** Resultado de POST /auth/refresh. Red caída o 5xx lanzan ApiError (no se pierde la sesión). */
export type RefreshResult = { ok: true; session: Session } | { ok: false }

export type LockManagerLike = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>
}

type Deps = {
  store: TokenStore
  requestRefresh: (refreshToken: string) => Promise<RefreshResult>
  locks?: LockManagerLike | null
  /** Espera antes de dar por muerta la sesión, para recibir avisos pendientes de otras pestañas. */
  graceMs?: number
}

const LOCK_NAME = "csstv:auth-refresh"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Devuelve `refresh(usedRefreshToken)`: renueva una sola vez aunque lo pidan muchas peticiones
 * o pestañas a la vez. Resuelve con la sesión vigente, o `null` si ya no hay sesión.
 */
export function createRefresher({
  store,
  requestRefresh,
  locks,
  graceMs = 100,
}: Deps) {
  let inflight: Promise<Session | null> | null = null

  const withLock = <T>(fn: () => Promise<T>): Promise<T> =>
    locks ? locks.request(LOCK_NAME, fn) : fn()

  // Lo guardado manda sobre la memoria: otra pestaña pudo renovar mientras esperábamos el lock.
  const current = () => store.readStored() ?? store.getState().session

  async function run(used: string): Promise<Session | null> {
    return withLock(async () => {
      const before = current()
      if (!before) return null
      if (before.refreshToken !== used) {
        store.syncFromStorage()
        return before
      }

      const result = await requestRefresh(before.refreshToken)
      if (result.ok) {
        store.setSession(result.session)
        return result.session
      }

      // Con sessionStorage cada pestaña tiene su copia y el aviso de la que renovó puede llegar tarde.
      await sleep(graceMs)
      const after = current()
      if (after && after.refreshToken !== before.refreshToken) {
        store.syncFromStorage()
        return after
      }
      store.revoke(before.refreshToken)
      return null
    })
  }

  return function refresh(usedRefreshToken: string): Promise<Session | null> {
    if (!inflight) {
      inflight = run(usedRefreshToken).finally(() => {
        inflight = null
      })
    }
    return inflight
  }
}

function isApiSession(v: unknown): v is ApiSession {
  if (!v || typeof v !== "object") return false
  const s = v as Record<string, unknown>
  return (
    typeof s.access_token === "string" &&
    typeof s.refresh_token === "string" &&
    typeof s.expires_at === "number"
  )
}

/** POST /auth/refresh con fetch directo: no pasa por authFetch para no entrar en bucle. */
export async function requestRefresh(
  refreshToken: string
): Promise<RefreshResult> {
  let res: Response
  try {
    res = await fetch(`${env.apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  } catch {
    throw networkError()
  }
  const body: unknown = await res.json().catch(() => null)
  if (res.ok) {
    if (!isApiSession(body))
      throw errorFromResponse(new Response(null, { status: 500 }), null)
    return { ok: true, session: toSession(body) }
  }
  // 400 = refresh_token mal formado: para el cliente es una sesión inválida.
  if (res.status === 401 || res.status === 400) return { ok: false }
  throw errorFromResponse(res, body)
}

export const refreshSession = createRefresher({
  store: tokenStore,
  requestRefresh,
  locks:
    typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks
      : null,
})
