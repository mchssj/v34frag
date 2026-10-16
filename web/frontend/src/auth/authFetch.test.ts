import { describe, expect, it, vi } from "vitest"

import {
  createBus,
  createLocks,
  createRefreshServer,
  MemoryStorage,
  session,
} from "@/test/fakes"
import { createAuthFetch } from "./authFetch"
import { createRefresher } from "./refresh"
import { createTokenStore, STORAGE_KEY, type Session } from "./tokenStore"

const API = "http://api.test"

function makeStore(start: Session | null) {
  const local = new MemoryStorage()
  if (start) local.setItem(STORAGE_KEY, JSON.stringify(start))
  return createTokenStore({
    local,
    session: new MemoryStorage(),
    channel: null,
  })
}

type Handler = (req: Request) => Response | Promise<Response>

/** fetch falso que registra lo que recibe. */
function fakeFetch(handler: Handler) {
  const calls: { url: string; auth: string | null; body: string }[] = []
  const fn = vi.fn(async (req: Request) => {
    calls.push({
      url: req.url,
      auth: req.headers.get("Authorization"),
      body: await req.clone().text(),
    })
    return handler(req)
  })
  return { fn: fn as unknown as typeof fetch, calls }
}

const ok = () => new Response("{}", { status: 200 })
const unauthorized = () =>
  new Response('{"error":{"code":"UNAUTHORIZED"}}', { status: 401 })

describe("authFetch", () => {
  it("agrega el Bearer si hay sesión", async () => {
    const store = makeStore(session(1))
    const f = fakeFetch(ok)
    const authFetch = createAuthFetch({ store, refresh: vi.fn(), fetch: f.fn })
    await authFetch(`${API}/api/v1/me/profile`)
    expect(f.calls[0].auth).toBe("Bearer a1")
  })

  it("no manda el token a login, registro ni refresh", async () => {
    const store = makeStore(session(1))
    const f = fakeFetch(ok)
    const authFetch = createAuthFetch({ store, refresh: vi.fn(), fetch: f.fn })
    await authFetch(`${API}/auth/login`, { method: "POST", body: "{}" })
    expect(f.calls[0].auth).toBeNull()
  })

  it("tras un 401 renueva una vez y reintenta con el mismo cuerpo", async () => {
    const store = makeStore(session(1))
    const f = fakeFetch((req) =>
      req.headers.get("Authorization") === "Bearer a1" ? unauthorized() : ok()
    )
    const refresh = vi.fn(async () => {
      store.setSession(session(2))
      return session(2)
    })
    const authFetch = createAuthFetch({ store, refresh, fetch: f.fn })
    const res = await authFetch(`${API}/api/v1/me/profile`, {
      method: "PATCH",
      body: '{"discord":"x"}',
    })
    expect(res.status).toBe(200)
    expect(refresh).toHaveBeenCalledOnce()
    expect(f.calls).toHaveLength(2)
    expect(f.calls[1]).toMatchObject({
      auth: "Bearer a2",
      body: '{"discord":"x"}',
    })
  })

  it("si el reintento también da 401, no entra en bucle", async () => {
    const store = makeStore(session(1))
    const f = fakeFetch(unauthorized)
    const refresh = vi.fn(async () => session(2))
    const authFetch = createAuthFetch({ store, refresh, fetch: f.fn })
    const res = await authFetch(`${API}/auth/me`)
    expect(res.status).toBe(401)
    expect(refresh).toHaveBeenCalledOnce()
    expect(f.calls).toHaveLength(2)
  })

  it("si la renovación falla, reintenta sin Authorization (rutas públicas)", async () => {
    const store = makeStore(session(1))
    const f = fakeFetch((req) =>
      req.headers.get("Authorization") ? unauthorized() : ok()
    )
    const refresh = vi.fn(async () => null)
    const authFetch = createAuthFetch({ store, refresh, fetch: f.fn })
    const res = await authFetch(`${API}/api/v1/players/123`)
    expect(res.status).toBe(200)
    expect(f.calls[1].auth).toBeNull()
  })

  it("no reintenta el logout tras un 401", async () => {
    const store = makeStore(session(1))
    const f = fakeFetch(unauthorized)
    const refresh = vi.fn()
    const authFetch = createAuthFetch({ store, refresh, fetch: f.fn })
    const res = await authFetch(`${API}/auth/logout`, { method: "POST" })
    expect(res.status).toBe(401)
    expect(refresh).not.toHaveBeenCalled()
    expect(f.calls).toHaveLength(1)
  })

  it("renueva antes de pedir si el token está por vencer", async () => {
    const store = makeStore(session(1, 30_000))
    const f = fakeFetch(ok)
    const refresh = vi.fn(async () => session(2))
    const authFetch = createAuthFetch({ store, refresh, fetch: f.fn })
    await authFetch(`${API}/api/v1/me/profile`)
    expect(refresh).toHaveBeenCalledWith("r1")
    expect(f.calls[0].auth).toBe("Bearer a2")
  })

  it("si la renovación anticipada falla por red, pide igual con el token actual", async () => {
    const store = makeStore(session(1, 30_000))
    const f = fakeFetch(ok)
    const refresh = vi.fn(async () => {
      throw new TypeError("red")
    })
    const authFetch = createAuthFetch({ store, refresh, fetch: f.fn })
    const res = await authFetch(`${API}/api/v1/me/profile`)
    expect(res.status).toBe(200)
    expect(f.calls[0].auth).toBe("Bearer a1")
  })

  it("varias peticiones con 401 a la vez comparten una sola renovación", async () => {
    const local = new MemoryStorage()
    local.setItem(STORAGE_KEY, JSON.stringify(session(1)))
    const store = createTokenStore({
      local,
      session: new MemoryStorage(),
      channel: createBus().channel(),
    })
    const server = createRefreshServer()
    const refresh = createRefresher({
      store,
      requestRefresh: (t) => server.refresh(t),
      locks: createLocks(),
    })
    const f = fakeFetch((req) =>
      req.headers.get("Authorization") === "Bearer a2" ? ok() : unauthorized()
    )
    const authFetch = createAuthFetch({ store, refresh, fetch: f.fn })

    const results = await Promise.all([
      authFetch(`${API}/api/v1/me/profile`),
      authFetch(`${API}/auth/me`),
      authFetch(`${API}/api/v1/me/profile-requests`),
    ])
    expect(results.map((r) => r.status)).toEqual([200, 200, 200])
    expect(server.calls).toBe(1)
  })
})
