import { describe, expect, it, vi } from "vitest"

import { networkError } from "@/api/errors"
import {
  createBus,
  createLocks,
  createRefreshServer,
  MemoryStorage,
  session,
  tick,
} from "@/test/fakes"
import { createRefresher, type LockManagerLike } from "./refresh"
import { createTokenStore, STORAGE_KEY } from "./tokenStore"

type Server = ReturnType<typeof createRefreshServer>

function tab(opts: {
  local: MemoryStorage
  bus: ReturnType<typeof createBus>
  locks: LockManagerLike
  server: Server
  start?: { n: number; remember: boolean }
}) {
  const own = new MemoryStorage()
  if (opts.start) {
    const target = opts.start.remember ? opts.local : own
    target.setItem(STORAGE_KEY, JSON.stringify(session(opts.start.n)))
  }
  const store = createTokenStore({
    local: opts.local,
    session: own,
    channel: opts.bus.channel(),
  })
  const refresh = createRefresher({
    store,
    requestRefresh: (t) => opts.server.refresh(t),
    locks: opts.locks,
    graceMs: 20,
  })
  return { store, refresh, own }
}

function setup() {
  return {
    local: new MemoryStorage(),
    bus: createBus(),
    locks: createLocks(),
    server: createRefreshServer(),
  }
}

describe("refresh en una pestaña", () => {
  it("diez renovaciones simultáneas hacen una sola llamada a la API", async () => {
    const env = setup()
    const a = tab({ ...env, start: { n: 1, remember: true } })
    const results = await Promise.all(
      Array.from({ length: 10 }, () => a.refresh("r1"))
    )
    expect(env.server.calls).toBe(1)
    expect(results.every((s) => s?.refreshToken === "r2")).toBe(true)
    expect(env.local.session()?.refreshToken).toBe("r2")
  })

  it("si el refresh token guardado ya cambió, no llama a la API", async () => {
    const env = setup()
    const a = tab({ ...env, start: { n: 1, remember: true } })
    env.local.setItem(STORAGE_KEY, JSON.stringify(session(5)))
    const s = await a.refresh("r1")
    expect(env.server.calls).toBe(0)
    expect(s?.refreshToken).toBe("r5")
    expect(a.store.getState().session?.refreshToken).toBe("r5")
  })

  it("un 401 con el token vigente borra la sesión", async () => {
    const env = setup()
    const a = tab({ ...env, start: { n: 1, remember: true } })
    const server = {
      ...env.server,
      refresh: vi.fn(async () => ({ ok: false as const })),
    }
    const refresh = createRefresher({
      store: a.store,
      requestRefresh: server.refresh,
      locks: env.locks,
      graceMs: 10,
    })
    expect(await refresh("r1")).toBeNull()
    expect(a.store.getState().session).toBeNull()
    expect(a.store.getState().lastChange).toBe("expired")
    expect(env.local.session()).toBeNull()
  })

  it("un error de red no borra la sesión", async () => {
    const env = setup()
    const a = tab({ ...env, start: { n: 1, remember: true } })
    const refresh = createRefresher({
      store: a.store,
      requestRefresh: () => Promise.reject(networkError()),
      locks: env.locks,
    })
    await expect(refresh("r1")).rejects.toMatchObject({ code: "NETWORK" })
    expect(a.store.getState().session?.refreshToken).toBe("r1")
  })

  it("sin sesión devuelve null sin llamar a la API", async () => {
    const env = setup()
    const a = tab(env)
    expect(await a.refresh("r1")).toBeNull()
    expect(env.server.calls).toBe(0)
  })

  it("funciona sin navigator.locks", async () => {
    const env = setup()
    const a = tab({ ...env, start: { n: 1, remember: true } })
    const refresh = createRefresher({
      store: a.store,
      requestRefresh: (t) => env.server.refresh(t),
      locks: null,
    })
    expect((await refresh("r1"))?.refreshToken).toBe("r2")
  })
})

describe("refresh entre pestañas", () => {
  it("con Recordarme, la segunda pestaña usa la sesión que renovó la primera", async () => {
    const env = setup()
    const a = tab({ ...env, start: { n: 1, remember: true } })
    const b = tab(env)
    expect(b.store.getState().session?.refreshToken).toBe("r1")

    const [sa, sb] = await Promise.all([a.refresh("r1"), b.refresh("r1")])
    expect(env.server.calls).toBe(1)
    expect(sa?.refreshToken).toBe("r2")
    expect(sb?.refreshToken).toBe("r2")
  })

  it("sin Recordarme: B obtiene el lock antes del aviso de A, recibe 401 y termina con la sesión de A", async () => {
    const env = setup()
    const a = tab({ ...env, start: { n: 1, remember: false } })
    const b = tab(env)
    // B recibe la sesión de A por el saludo entre pestañas y guarda su propia copia.
    await b.store.ready()
    await tick()
    expect(b.own.session()?.refreshToken).toBe("r1")

    const [sa, sb] = await Promise.all([a.refresh("r1"), b.refresh("r1")])

    // B intentó con el token viejo (el aviso de A todavía no había llegado) y recibió 401.
    expect(env.server.calls).toBe(2)
    expect(sa?.refreshToken).toBe("r2")
    expect(sb?.refreshToken).toBe("r2")
    await tick(30)
    expect(a.store.getState().session?.refreshToken).toBe("r2")
    expect(b.store.getState().session?.refreshToken).toBe("r2")
    expect(a.own.session()?.refreshToken).toBe("r2")
    expect(b.own.session()?.refreshToken).toBe("r2")
  })

  it("una sesión revocada en una pestaña se cierra también en la otra", async () => {
    const env = setup()
    const a = tab({ ...env, start: { n: 1, remember: true } })
    const b = tab(env)
    const dead = createRefresher({
      store: a.store,
      requestRefresh: async () => ({ ok: false as const }),
      locks: env.locks,
      graceMs: 10,
    })
    expect(await dead("r1")).toBeNull()
    await tick()
    expect(b.store.getState().session).toBeNull()
  })
})
