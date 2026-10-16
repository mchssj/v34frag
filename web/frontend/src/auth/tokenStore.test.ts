import { describe, expect, it } from "vitest"

import { createBus, MemoryStorage, session, tick } from "@/test/fakes"
import { createTokenStore, STORAGE_KEY, toSession } from "./tokenStore"

function tab(
  local: MemoryStorage,
  bus = createBus(),
  own = new MemoryStorage()
) {
  const store = createTokenStore({
    local,
    session: own,
    channel: bus.channel(),
    handshakeMs: 30,
  })
  return { store, own }
}

describe("toSession", () => {
  it("convierte expires_at de segundos a milisegundos", () => {
    const s = toSession({
      access_token: "a",
      refresh_token: "r",
      expires_at: 1_800_000_000,
    })
    expect(s.expiresAt).toBe(1_800_000_000_000)
  })

  it("no vuelve a multiplicar si ya viene en milisegundos", () => {
    const s = toSession({
      access_token: "a",
      refresh_token: "r",
      expires_at: 1_800_000_000_000,
    })
    expect(s.expiresAt).toBe(1_800_000_000_000)
  })
})

describe("tokenStore: persistencia", () => {
  it("con Recordarme guarda en localStorage y borra la copia de sessionStorage", () => {
    const local = new MemoryStorage()
    const { store, own } = tab(local)
    own.setItem(STORAGE_KEY, JSON.stringify(session(9)))
    store.setSession(session(1), true)
    expect(local.session()?.refreshToken).toBe("r1")
    expect(own.session()).toBeNull()
  })

  it("sin Recordarme guarda en sessionStorage y borra localStorage", () => {
    const local = new MemoryStorage()
    const { store, own } = tab(local)
    store.setSession(session(1), true)
    store.setSession(session(2), false)
    expect(own.session()?.refreshToken).toBe("r2")
    expect(local.session()).toBeNull()
    expect(store.getState().remember).toBe(false)
  })

  it("al cargar recupera la sesión guardada y el modo", () => {
    const local = new MemoryStorage()
    local.setItem(STORAGE_KEY, JSON.stringify(session(1)))
    const { store } = tab(local)
    expect(store.getState().session?.refreshToken).toBe("r1")
    expect(store.getState().remember).toBe(true)
  })

  it("descarta una sesión guardada con formato inválido", () => {
    const local = new MemoryStorage()
    local.setItem(STORAGE_KEY, '{"accessToken": 1}')
    const { store } = tab(local)
    expect(store.getState().session).toBeNull()
    expect(local.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe("tokenStore: varias pestañas", () => {
  it("el login en una pestaña llega a la otra", async () => {
    const bus = createBus()
    const local = new MemoryStorage()
    const a = tab(local, bus)
    const b = tab(local, bus)
    a.store.setSession(session(1), true)
    await tick()
    expect(b.store.getState().session?.refreshToken).toBe("r1")
    expect(b.store.getState().lastChange).toBe("remote")
  })

  it("sin Recordarme, la otra pestaña guarda su propia copia en sessionStorage", async () => {
    const bus = createBus()
    const local = new MemoryStorage()
    const a = tab(local, bus)
    const b = tab(local, bus)
    a.store.setSession(session(1), false)
    await tick()
    expect(b.own.session()?.refreshToken).toBe("r1")
    expect(local.session()).toBeNull()
  })

  it("una pestaña nueva pide la sesión a las demás (sessionStorage no se comparte)", async () => {
    const bus = createBus()
    const local = new MemoryStorage()
    const a = tab(local, bus)
    a.store.setSession(session(1), false)
    const b = tab(local, bus)
    await b.store.ready()
    expect(b.store.getState().session?.refreshToken).toBe("r1")
  })

  it("ready se resuelve aunque nadie responda", async () => {
    const { store } = tab(new MemoryStorage())
    await expect(store.ready()).resolves.toBeUndefined()
    expect(store.getState().session).toBeNull()
  })

  it("el logout cierra la sesión en todas las pestañas", async () => {
    const bus = createBus()
    const local = new MemoryStorage()
    const a = tab(local, bus)
    const b = tab(local, bus)
    a.store.setSession(session(1), false)
    await tick()
    b.store.logout()
    await tick()
    expect(a.store.getState().session).toBeNull()
    expect(a.own.session()).toBeNull()
    expect(a.store.getState().lastChange).toBe("remote")
  })

  it("un aviso de revocación con otro refresh token no cierra la sesión", async () => {
    const bus = createBus()
    const local = new MemoryStorage()
    const a = tab(local, bus)
    const b = tab(local, bus)
    a.store.setSession(session(2), false)
    await tick()
    b.store.setState({ session: session(1) })
    b.store.revoke("r1")
    await tick()
    expect(a.store.getState().session?.refreshToken).toBe("r2")
  })

  it("un aviso de revocación con el mismo refresh token sí la cierra", async () => {
    const bus = createBus()
    const local = new MemoryStorage()
    const a = tab(local, bus)
    const b = tab(local, bus)
    a.store.setSession(session(1), false)
    await tick()
    b.store.revoke("r1")
    await tick()
    expect(a.store.getState().session).toBeNull()
    expect(a.store.getState().lastChange).toBe("expired")
  })

  it("revoke no borra de localStorage una sesión más nueva", () => {
    const local = new MemoryStorage()
    const { store } = tab(local)
    store.setSession(session(1), true)
    local.setItem(STORAGE_KEY, JSON.stringify(session(2)))
    store.revoke("r1")
    expect(local.session()?.refreshToken).toBe("r2")
    expect(store.getState().session).toBeNull()
  })
})
