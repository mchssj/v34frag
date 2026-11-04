import { afterEach, describe, expect, it, vi } from "vitest"

import { resetServerClock, serverNow, syncServerClock } from "./serverClock"

afterEach(() => {
  resetServerClock()
  vi.useRealTimers()
})

describe("serverClock", () => {
  it("corrige una PC con el reloj 8 s adelantado", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-02T20:00:08Z"))
    syncServerClock("2026-11-02T20:00:00Z")
    expect(new Date(serverNow()).toISOString()).toBe("2026-11-02T20:00:00.000Z")
    // Un plazo de 15 s desde la hora del servidor quedan 15 s, no 7.
    const deadline = Date.parse("2026-11-02T20:00:15Z")
    expect(Math.round((deadline - serverNow()) / 1000)).toBe(15)
  })

  it("descuenta la mitad de lo que tardó el pedido", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-02T20:00:00Z"))
    syncServerClock("2026-11-02T20:00:00Z", 400)
    expect(serverNow() - Date.now()).toBe(200)
  })

  it("ignora un valor inválido", () => {
    syncServerClock("no es una fecha")
    syncServerClock(null)
    expect(Math.abs(serverNow() - Date.now())).toBeLessThan(5)
  })
})
