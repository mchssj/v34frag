import { tokenStore } from "@/auth/tokenStore"
import { env } from "@/lib/env"
import type { MmSocketFactory } from "./source"
import type { MmEvent } from "./types"

type Deps = {
  url: string
  getToken: () => string | null
  /** Avisa cuando cambia el token (renovación) para mandar un `auth` nuevo. */
  onTokenChange: (fn: () => void) => () => void
  WebSocketImpl?: typeof WebSocket
  random?: () => number
}

/** Espera antes de reconectar: 1, 2, 4… hasta 30 s, más hasta 1 s al azar para no volver todos juntos. */
export function reconnectDelay(attempt: number, random = Math.random) {
  return Math.min(30_000, 1000 * 2 ** attempt) + Math.floor(random() * 1000)
}

/**
 * Socket del matchmaking (plan, sección 5). El token va en el primer mensaje, nunca en la URL. Si
 * se corta, reconecta solo; mientras tanto `onStatus(false)` activa el polling de respaldo.
 */
export function createMmSocket({
  url,
  getToken,
  onTokenChange,
  WebSocketImpl = WebSocket,
  random = Math.random,
}: Deps): MmSocketFactory {
  return (onEvent, onStatus) => {
    let ws: WebSocket | null = null
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let closed = false

    const sendAuth = () => {
      const token = getToken()
      if (ws?.readyState === WebSocketImpl.OPEN && token)
        ws.send(JSON.stringify({ t: "auth", token }))
    }

    const connect = () => {
      if (closed || !getToken()) return
      ws = new WebSocketImpl(url)
      ws.onopen = sendAuth
      ws.onmessage = (msg) => {
        let event: MmEvent
        try {
          event = JSON.parse(String(msg.data)) as MmEvent
        } catch {
          return
        }
        if (event.t === "ready") {
          attempt = 0
          onStatus(true)
        }
        // "ready" y "resync" también piden el estado: pudo cambiar mientras no había socket.
        onEvent(event)
      }
      ws.onclose = (e) => {
        onStatus(false)
        ws = null
        // 4001 = token vencido o inválido: sin token nuevo no tiene sentido insistir.
        if (closed || (e.code === 4001 && !getToken())) return
        timer = setTimeout(connect, reconnectDelay(attempt++, random))
      }
    }

    const stopToken = onTokenChange(sendAuth)
    connect()

    return () => {
      closed = true
      clearTimeout(timer)
      stopToken()
      ws?.close(1000)
    }
  }
}

export const mmSocket = createMmSocket({
  url: `${env.apiUrl.replace(/^http/, "ws")}/api/v1/mm/ws`,
  getToken: () => tokenStore.getState().session?.accessToken ?? null,
  onTokenChange: (fn) =>
    tokenStore.subscribe((s, prev) => {
      if (s.session?.accessToken !== prev.session?.accessToken) fn()
    }),
})
