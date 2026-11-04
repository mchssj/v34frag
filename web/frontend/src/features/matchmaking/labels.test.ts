import { describe, expect, it } from "vitest"

import { eloWindow } from "./demo"
import {
  connectCommand,
  fmtClock,
  maskPassword,
  secondsLeft,
  steamConnectUrl,
  teamElo,
} from "./labels"
import { reconnectDelay } from "./socket"
import type { MmPlayer } from "./types"

describe("labels", () => {
  it("fmtClock", () => {
    expect(fmtClock(7_000)).toBe("0:07")
    expect(fmtClock(65_400)).toBe("1:05")
    expect(fmtClock(-5)).toBe("0:00")
  })

  it("secondsLeft redondea para arriba y no baja de 0", () => {
    const now = Date.parse("2026-10-28T12:00:00Z")
    expect(secondsLeft("2026-10-28T12:00:10.200Z", now)).toBe(11)
    expect(secondsLeft("2026-10-28T11:59:00Z", now)).toBe(0)
    expect(secondsLeft(null, now)).toBe(0)
  })

  it("connect con la contraseña", () => {
    expect(steamConnectUrl("1.2.3.4:27015", "ab c")).toBe(
      "steam://connect/1.2.3.4:27015/ab%20c"
    )
    expect(connectCommand("1.2.3.4:27015", "k3x9")).toBe(
      "connect 1.2.3.4:27015; password k3x9"
    )
  })

  it("maskPassword no deja ver el largo si es corta", () => {
    expect(maskPassword("abc")).toBe("••••••")
    expect(maskPassword("abcdefgh")).toHaveLength(8)
  })

  it("teamElo promedia solo ese equipo", () => {
    const p = (team: 1 | 2, elo: number) => ({ team, elo }) as MmPlayer
    expect(teamElo([p(1, 1000), p(1, 1501), p(2, 3000)], 1)).toBe(1251)
    expect(teamElo([], 2)).toBe(0)
  })
})

describe("ventana de ELO y reconexión", () => {
  it("la ventana se abre 50 cada 30 s, tope 600 y sin límite a los 5 min", () => {
    expect(eloWindow(0)).toBe(150)
    expect(eloWindow(61_000)).toBe(250)
    expect(eloWindow(290_000)).toBe(600)
    expect(eloWindow(300_000)).toBeNull()
  })

  it("la espera para reconectar crece hasta 30 s", () => {
    expect(reconnectDelay(0, () => 0)).toBe(1000)
    expect(reconnectDelay(3, () => 0.5)).toBe(8500)
    expect(reconnectDelay(10, () => 0)).toBe(30_000)
  })
})
