import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createMmSocket } from "./socket"

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
})
