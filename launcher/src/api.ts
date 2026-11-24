// Sesión y pedidos a la API, con el mismo protocolo que la web (web/frontend/src/auth).

export const API_URL = (import.meta.env.VITE_API_URL ?? "https://api.cmleague.lat").replace(/\/+$/, "")

export type Session = { accessToken: string; refreshToken: string; expiresAt: number }
type ApiSession = { access_token: string; refresh_token: string; expires_at: number }

const KEY = "cmleague.session"

// Versión 1: en el almacenamiento del WebView. Antes de publicar pasa al Administrador de credenciales de Windows
// (plan, decisión "Dónde se guarda la sesión").
export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    /* sin almacenamiento: la sesión dura lo que la ventana */
  }
}

const toSession = (s: ApiSession): Session => ({
  accessToken: s.access_token,
  refreshToken: s.refresh_token,
  expiresAt: s.expires_at < 1e12 ? s.expires_at * 1000 : s.expires_at,
})

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function errorOf(res: Response): Promise<ApiError> {
  let msg = `Error ${res.status}`
  try {
    const body = (await res.json()) as { error?: { message?: string }; message?: string }
    msg = body.error?.message ?? body.message ?? msg
  } catch {
    /* sin cuerpo */
  }
  return new ApiError(res.status, msg)
}

let session = loadSession()
const listeners = new Set<(s: Session | null) => void>()

export const getSession = () => session
export function onSession(fn: (s: Session | null) => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
function setSession(s: Session | null) {
  session = s
  saveSession(s)
  listeners.forEach((fn) => fn(s))
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw await errorOf(res)
  setSession(toSession((await res.json()) as ApiSession))
}

export async function logout() {
  const s = session
  setSession(null)
  if (s)
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${s.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refreshToken }),
    }).catch(() => undefined)
}

let refreshing: Promise<Session | null> | null = null

/** Un token vigente: lo renueva si le queda menos de un minuto (el mismo margen que authFetch de la web). */
export async function freshToken(): Promise<string | null> {
  const s = session
  if (!s) return null
  if (s.expiresAt - 60_000 > Date.now()) return s.accessToken
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: s.refreshToken }),
      })
      if (res.status === 400 || res.status === 401) {
        setSession(null)
        return null
      }
      if (!res.ok) return s
      const next = toSession((await res.json()) as ApiSession)
      setSession(next)
      return next
    } catch {
      return s
    } finally {
      refreshing = null
    }
  })()
  return (await refreshing)?.accessToken ?? null
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await freshToken()
  if (!token) throw new ApiError(401, "Tu sesión venció. Volvé a iniciar sesión.")
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 401) setSession(null)
  if (!res.ok) throw await errorOf(res)
  return (res.status === 204 ? undefined : await res.json()) as T
}
