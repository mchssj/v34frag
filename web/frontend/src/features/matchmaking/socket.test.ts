import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createMmSocket, MM_SILENCE_MS } from "./socket"

// Un WebSocket de mentira: se abre al instante y se cierra cuando la prueba lo pide.
class FakeWs {
  static OPEN = 1
  static all: FakeWs[] = []
  readyState = FakeWs.OPEN
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((m: { data: string }) => void) | null = null
  onclose: ((e: { code: number }) => void) | null = null
  url: string
  constructor(url: string) {
    this.url = url
    FakeWs.all.push(this)
    queueMicrotask(() => this.onopen?.())
  }
  send(m: string) {
    this.sent.push(m)
  }
  close() {}
  drop() {
    this.onclose?.({ code: 1006 })
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeWs.all = []
})
afterEach(() => {
  vi.useRealTimers()
})

describe("socket del matchmaking", () => {
  it("al volver internet reconecta ya, sin esperar el turno", async () => {
    let online: () => void = () => {}
    const open = createMmSocket({
      url: "ws://x",
      getToken: () => "t",
      onTokenChange: () => () => {},
      WebSocketImpl: FakeWs as unknown as typeof WebSocket,
      random: () => 0,
      onOnline: (fn) => {
        online = fn
        return () => {}
      },
    })
    const stop = open(
      () => {},
      () => {}
    )
    expect(FakeWs.all).toHaveLength(1)
    // Tres cortes seguidos: el próximo intento sería en 8 s.
    for (let i = 0; i < 3; i++) {
      FakeWs.all.at(-1)!.drop()
      await vi.advanceTimersByTimeAsync(2 ** i * 1000)
    }
    FakeWs.all.at(-1)!.drop()
    const before = FakeWs.all.length
    online()
    expect(FakeWs.all).toHaveLength(before + 1)
    // El intento programado ya no corre aparte.
    await vi.advanceTimersByTimeAsync(10_000)
    expect(FakeWs.all).toHaveLength(before + 1)
    stop()
  })

  it("con el socket abierto, el evento online no abre otro", () => {
    let online: () => void = () => {}
    const open = createMmSocket({
      url: "ws://x",
      getToken: () => "t",
      onTokenChange: () => () => {},
      WebSocketImpl: FakeWs as unknown as typeof WebSocket,
      onOnline: (fn) => {
        online = fn
        return () => {}
      },
    })
    const stop = open(
      () => {},
      () => {}
    )
    online()
    expect(FakeWs.all).toHaveLength(1)
    stop()
  })

  it("contesta el ping y no lo pasa a los que escuchan", async () => {
    const events: string[] = []
    const open = createMmSocket({
      url: "ws://x",
      getToken: () => "t",
      onTokenChange: () => () => {},
      WebSocketImpl: FakeWs as unknown as typeof WebSocket,
      onOnline: () => () => {},
    })
    const stop = open(
      (e) => events.push(e.t),
      () => {}
    )
    await vi.advanceTimersByTimeAsync(0)
    const ws = FakeWs.all[0]!
    ws.onmessage?.({ data: '{"t":"ping"}' })
    expect(ws.sent.at(-1)).toBe('{"t":"pong"}')
    expect(events).toEqual([])
    stop()
  })

  it("si no llega nada en 40 s, descarta la conexión y abre otra", async () => {
    const status: boolean[] = []
    const open = createMmSocket({
      url: "ws://x",
      getToken: () => "t",
      onTokenChange: () => () => {},
      WebSocketImpl: FakeWs as unknown as typeof WebSocket,
      onOnline: () => () => {},
    })
    const stop = open(
      () => {},
      (up) => status.push(up)
    )
    await vi.advanceTimersByTimeAsync(0)
    FakeWs.all[0]!.onmessage?.({ data: '{"t":"ready"}' })
    await vi.advanceTimersByTimeAsync(MM_SILENCE_MS - 1)
    expect(FakeWs.all).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(FakeWs.all).toHaveLength(2)
    expect(status).toEqual([true, false])
    stop()
  })
})
