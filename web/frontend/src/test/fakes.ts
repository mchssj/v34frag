import type { LockManagerLike } from "@/auth/refresh"
import type {
  AuthChannel,
  AuthMessage,
  KeyValueStorage,
  Session,
} from "@/auth/tokenStore"
import { STORAGE_KEY } from "@/auth/tokenStore"

export class MemoryStorage implements KeyValueStorage {
  private data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
  session(): Session | null {
    const raw = this.data.get(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  }
}

/** Bus entre pestañas: como BroadcastChannel, no se entrega a sí mismo y la entrega es asíncrona. */
export function createBus(delayMs = 0) {
  const subscribers = new Set<{ owner: object; fn: (m: AuthMessage) => void }>()
  return {
    channel(): AuthChannel {
      const owner = {}
      return {
        post(msg) {
          const copy = structuredClone(msg)
          for (const s of subscribers) {
            if (s.owner !== owner) setTimeout(() => s.fn(copy), delayMs)
          }
        },
        subscribe(fn) {
          const entry = { owner, fn }
          subscribers.add(entry)
          return () => subscribers.delete(entry)
        },
      }
    },
  }
}

/** navigator.locks simplificado: una cola por nombre, compartida entre pestañas. */
export function createLocks(): LockManagerLike {
  const tails = new Map<string, Promise<unknown>>()
  return {
    request<T>(name: string, callback: () => Promise<T>): Promise<T> {
      const prev = tails.get(name) ?? Promise.resolve()
      const run = prev.then(callback, callback)
      tails.set(
        name,
        run.catch(() => undefined)
      )
      return run
    },
  }
}

export function session(n: number, expiresInMs = 3_600_000): Session {
  return {
    accessToken: `a${n}`,
    refreshToken: `r${n}`,
    expiresAt: Date.now() + expiresInMs,
  }
}

/** Servidor de refresh con rotación: cada refresh_token sirve una sola vez. */
export function createRefreshServer(start = 1) {
  let current = start
  const server = {
    calls: 0,
    valid: () => `r${current}`,
    async refresh(token: string) {
      server.calls++
      await Promise.resolve()
      if (token !== `r${current}`) return { ok: false as const }
      current++
      return { ok: true as const, session: session(current) }
    },
  }
  return server
}

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))
