// Socket del matchmaking: mismo protocolo que web/frontend/src/features/matchmaking/socket.ts.
// El token va en el primer mensaje; la API manda un ping cada 15 s y se contesta pong.
// Con el socket abierto la API cuenta al jugador como presente y no lo saca de la cola (replanteo 63).
import { API_URL, freshToken } from "./api"
import type { MmEvent } from "./types"

const SILENCE_MS = 40_000

export function connectMm(onEvent: (e: MmEvent) => void, onStatus: (up: boolean) => void) {
  let ws: WebSocket | null = null
  let attempt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let silence: ReturnType<typeof setTimeout> | undefined
  let closed = false

  const watch = () => {
    clearTimeout(silence)
    silence = setTimeout(() => ws?.close(), SILENCE_MS)
  }

  const connect = () => {
    if (closed) return
    ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}/api/v1/mm/ws`)
    ws.onopen = async () => {
      watch()
      const token = await freshToken()
      if (token && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "auth", token }))
    }
    ws.onmessage = (msg) => {
      watch()
      let event: MmEvent
      try {
        event = JSON.parse(String(msg.data)) as MmEvent
      } catch {
        return
      }
      if (event.t === "ping") {
        ws?.send('{"t":"pong"}')
        return
      }
      if (event.t === "ready") {
        attempt = 0
        onStatus(true)
      }
      onEvent(event)
    }
    ws.onclose = () => {
      clearTimeout(silence)
      onStatus(false)
      ws = null
      if (closed) return
      timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempt++) + Math.floor(Math.random() * 1000))
    }
  }

  connect()
  return () => {
    closed = true
    clearTimeout(timer)
    clearTimeout(silence)
    ws?.close(1000)
  }
}
