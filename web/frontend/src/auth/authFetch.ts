import { refreshSession } from "./refresh"
import { tokenStore, type Session, type TokenStore } from "./tokenStore"

type Deps = {
  store: TokenStore
  refresh: (usedRefreshToken: string) => Promise<Session | null>
  fetch?: typeof fetch
  now?: () => number
  /** Margen para renovar antes del vencimiento (también cubre desfase de reloj). */
  earlyRefreshMs?: number
}

// Rutas que no se reintentan tras un 401: crean o cierran la sesión.
const SESSION_ROUTES = new Set([
  "/auth/login",
  "/auth/signup",
  "/auth/refresh",
  "/auth/logout",
])
// En estas no se manda el token: no lo necesitan.
const NO_TOKEN_ROUTES = new Set([
  "/auth/login",
  "/auth/signup",
  "/auth/refresh",
])

export function createAuthFetch({
  store,
  refresh,
  fetch: baseFetch = (...args) => globalThis.fetch(...args),
  now = Date.now,
  earlyRefreshMs = 60_000,
}: Deps) {
  function send(req: Request, token: string | null): Promise<Response> {
    const headers = new Headers(req.headers)
    if (token) headers.set("Authorization", `Bearer ${token}`)
    else headers.delete("Authorization")
    return baseFetch(new Request(req, { headers }))
  }

  return async function authFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const req = new Request(input, init)
    const path = new URL(req.url).pathname
    if (NO_TOKEN_ROUTES.has(path)) return send(req, null)

    let session = store.getState().session
    const isSessionRoute = SESSION_ROUTES.has(path)
    let refreshed = false

    // Incluye /auth/logout: con un token vencido el logout no podría revocar el refresh token.
    if (session && session.expiresAt - earlyRefreshMs <= now()) {
      try {
        session = await refresh(session.refreshToken)
        refreshed = true
      } catch {
        // Red caída al renovar: se intenta igual con el token actual.
      }
    }

    // Se clona antes de enviar para poder reintentar con el mismo cuerpo.
    const retry = req.clone()
    const first = await send(req, session?.accessToken ?? null)
    if (first.status !== 401 || !session || isSessionRoute || refreshed)
      return first

    const renewed = await refresh(session.refreshToken)
    // Sin sesión válida, la ruta puede ser pública: se reintenta una vez como visitante.
    return send(retry, renewed?.accessToken ?? null)
  }
}

export const authFetch = createAuthFetch({
  store: tokenStore,
  refresh: refreshSession,
})
