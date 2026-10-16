import { createStore, type StoreApi } from "zustand/vanilla"

/** Sesión del frontend. `expiresAt` en milisegundos. */
export type Session = {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

/** Sesión tal como la devuelve la API (`expires_at` en segundos Unix). */
export type ApiSession = {
  access_token: string
  refresh_token: string
  expires_at: number
}

export function toSession(s: ApiSession): Session {
  return {
    accessToken: s.access_token,
    refreshToken: s.refresh_token,
    // La API manda segundos; si algún día llegan milisegundos, no se multiplican de nuevo.
    expiresAt: s.expires_at < 1e12 ? s.expires_at * 1000 : s.expires_at,
  }
}

export type AuthMessage =
  | { type: "hello" }
  | { type: "session"; session: Session; remember: boolean }
  | { type: "logout" }
  | { type: "revoked"; refreshToken: string }

export type AuthChannel = {
  post(msg: AuthMessage): void
  subscribe(fn: (msg: AuthMessage) => void): () => void
}

export type KeyValueStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>

/**
 * Origen del último cambio: `local` (login o logout en esta pestaña), `remote` (otra pestaña)
 * o `expired` (la renovación falló). Lo usa AuthSync para saber si tiene que re-ejecutar las guardas.
 */
export type SessionChange = "init" | "local" | "remote" | "expired"

type State = {
  session: Session | null
  remember: boolean
  lastChange: SessionChange
}

export type TokenStore = StoreApi<State> & {
  setSession(session: Session, remember?: boolean): void
  /** Logout explícito: borra la sesión en todas las pestañas. */
  logout(): void
  /** Sesión que murió en la renovación: solo se borra donde siga ese mismo refresh token. */
  revoke(refreshToken: string): void
  /** Lee la sesión del storage (no de memoria). */
  readStored(): Session | null
  /** Pasa a memoria lo que haya en el storage, sin avisar a otras pestañas. */
  syncFromStorage(): Session | null
  /** Se resuelve cuando la pestaña ya sabe si hay sesión (espera breve a otras pestañas). */
  ready(): Promise<void>
}

export const STORAGE_KEY = "csstv.session"

type Options = {
  local: KeyValueStorage
  session: KeyValueStorage
  channel: AuthChannel | null
  handshakeMs?: number
}

function isSession(v: unknown): v is Session {
  if (!v || typeof v !== "object") return false
  const s = v as Record<string, unknown>
  return (
    typeof s.accessToken === "string" &&
    typeof s.refreshToken === "string" &&
    typeof s.expiresAt === "number"
  )
}

function readFrom(storage: KeyValueStorage): Session | null {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (isSession(parsed)) return parsed
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Storage bloqueado o JSON corrupto: se trata como sin sesión.
  }
  return null
}

function writeTo(storage: KeyValueStorage, s: Session) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // Sin storage (modo privado estricto): la sesión vive solo en memoria.
  }
}

function removeFrom(storage: KeyValueStorage, onlyIfToken?: string) {
  try {
    if (
      onlyIfToken !== undefined &&
      readFrom(storage)?.refreshToken !== onlyIfToken
    )
      return
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Igual que arriba.
  }
}

export function createTokenStore({
  local,
  session: sessionStorage_,
  channel,
  handshakeMs = 150,
}: Options): TokenStore {
  const fromLocal = readFrom(local)
  const initial = fromLocal ?? readFrom(sessionStorage_)
  const store = createStore<State>(() => ({
    session: initial,
    remember: fromLocal ? true : initial ? false : true,
    lastChange: "init",
  }))

  const own = () => (store.getState().remember ? local : sessionStorage_)

  function readStored(): Session | null {
    return readFrom(local) ?? readFrom(sessionStorage_)
  }

  function adopt(s: Session, remember: boolean) {
    if (remember) {
      removeFrom(sessionStorage_)
    } else {
      // sessionStorage es por pestaña: cada una guarda su copia.
      writeTo(sessionStorage_, s)
    }
    store.setState({ session: s, remember, lastChange: "remote" })
  }

  function clearLocal(lastChange: SessionChange) {
    removeFrom(local)
    removeFrom(sessionStorage_)
    store.setState({ session: null, lastChange })
  }

  let readyResolve: (() => void) | null = null
  const readyPromise = new Promise<void>((resolve) => {
    if (initial || !channel) return resolve()
    readyResolve = resolve
    setTimeout(resolve, handshakeMs)
  })

  channel?.subscribe((msg) => {
    const current = store.getState().session
    switch (msg.type) {
      case "hello":
        if (current)
          channel.post({
            type: "session",
            session: current,
            remember: store.getState().remember,
          })
        return
      case "session":
        if (current?.refreshToken !== msg.session.refreshToken)
          adopt(msg.session, msg.remember)
        readyResolve?.()
        return
      case "logout":
        clearLocal("remote")
        return
      case "revoked":
        // Otra pestaña perdió esa sesión; si acá ya hay una más nueva, se conserva.
        if (current?.refreshToken === msg.refreshToken) clearLocal("expired")
        return
    }
  })

  if (!initial) channel?.post({ type: "hello" })

  return Object.assign(store, {
    setSession(s: Session, remember = store.getState().remember) {
      writeTo(remember ? local : sessionStorage_, s)
      removeFrom(remember ? sessionStorage_ : local)
      store.setState({ session: s, remember, lastChange: "local" })
      channel?.post({ type: "session", session: s, remember })
    },
    logout() {
      clearLocal("local")
      channel?.post({ type: "logout" })
    },
    revoke(refreshToken: string) {
      removeFrom(local, refreshToken)
      removeFrom(sessionStorage_, refreshToken)
      if (store.getState().session?.refreshToken === refreshToken) {
        store.setState({ session: null, lastChange: "expired" })
      }
      channel?.post({ type: "revoked", refreshToken })
    },
    readStored,
    syncFromStorage() {
      const s = readFrom(own()) ?? readStored()
      if (s && s.refreshToken !== store.getState().session?.refreshToken) {
        store.setState({ session: s, lastChange: "remote" })
      }
      return s
    },
    ready: () => readyPromise,
  })
}

function browserStorage(get: () => Storage): KeyValueStorage {
  return {
    getItem: (k) => {
      try {
        return get().getItem(k)
      } catch {
        return null
      }
    },
    setItem: (k, v) => get().setItem(k, v),
    removeItem: (k) => get().removeItem(k),
  }
}

function browserChannel(name: string): AuthChannel | null {
  if (typeof BroadcastChannel === "undefined") return null
  const bc = new BroadcastChannel(name)
  return {
    post: (msg) => bc.postMessage(msg),
    subscribe: (fn) => {
      const onMessage = (e: MessageEvent) => {
        if (
          e.data &&
          typeof e.data === "object" &&
          typeof e.data.type === "string"
        )
          fn(e.data)
      }
      bc.addEventListener("message", onMessage)
      return () => bc.removeEventListener("message", onMessage)
    },
  }
}

export const tokenStore = createTokenStore({
  local: browserStorage(() => window.localStorage),
  session: browserStorage(() => window.sessionStorage),
  channel: browserChannel("csstv:auth"),
})
