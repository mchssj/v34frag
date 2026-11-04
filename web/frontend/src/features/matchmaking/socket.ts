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
  /** Avisa cuando el navegador recupera internet. Por defecto, el evento `online` de window. */
  onOnline?: (fn: () => void) => () => void
}

const windowOnline = (fn: () => void) => {
  window.addEventListener("online", fn)
  return () => window.removeEventListener("online", fn)
}

/**
 * Sin ningún mensaje (la API manda un ping cada 15 s) durante este tiempo, la conexión está medio muerta: se descarta y
 * se abre otra (plan docs/bitacora/2026-11-02-mm-socket-optimizado, error 2).
 */
export const MM_SILENCE_MS = 40_000

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
  onOnline = windowOnline,
}: Deps): MmSocketFactory {
  return (onEvent, onStatus) => {
    let ws: WebSocket | null = null
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let silence: ReturnType<typeof setTimeout> | undefined
    let closed = false

    // Cada mensaje rearma el plazo. Si vence, no se espera el cierre del navegador (puede tardar minutos).
    const watch = () => {
      clearTimeout(silence)
      silence = setTimeout(() => {
        const dead = ws
        if (!dead || closed) return
        dead.onclose = null
        dead.onmessage = null
        dead.close()
        ws = null
        onStatus(false)
        attempt = 0
        connect()
      }, MM_SILENCE_MS)
    }

    const sendAuth = () => {
      const token = getToken()
      if (ws?.readyState === WebSocketImpl.OPEN && token)
        ws.send(JSON.stringify({ t: "auth", token }))
    }

    const connect = () => {
      if (closed || !getToken()) return
      ws = new WebSocketImpl(url)
      ws.onopen = () => {
        watch()
        sendAuth()
      }
      ws.onmessage = (msg) => {
        watch()
        let event: MmEvent
        try {
          event = JSON.parse(String(msg.data)) as MmEvent
        } catch {
          return
        }
        // El latido no cambia nada: se contesta y no llega a los que escuchan.
        if (event.t === "ping") {
          ws?.send('{"t":"pong"}')
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
        clearTimeout(silence)
        onStatus(false)
        ws = null
        // 4001 = token vencido o inválido: sin token nuevo no tiene sentido insistir.
        if (closed || (e.code === 4001 && !getToken())) return
        timer = setTimeout(connect, reconnectDelay(attempt++, random))
      }
    }

    const stopToken = onTokenChange(sendAuth)
    // Al volver internet se reconecta ya, sin esperar el turno: la API saca de la cola a quien no vuelve en 10 s
    // (replanteo 63), y la espera entre intentos crece a 1, 2, 4… s.
    const stopOnline = onOnline(() => {
      if (closed || ws) return
      clearTimeout(timer)
      attempt = 0
      connect()
    })
    connect()

    return () => {
      closed = true
      clearTimeout(timer)
      clearTimeout(silence)
      stopToken()
      stopOnline()
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
