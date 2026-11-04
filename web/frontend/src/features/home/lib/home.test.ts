import { describe, expect, it } from "vitest"

import type { Notification } from "@/features/shell/notifications/lib/model"
import {
  dateLabel,
  greeting,
  levelProgress,
  pendingNotifications,
  weekDelta,
  winRate,
} from "./home"

const at = (h: number) => new Date(2026, 10, 3, h, 0)

const notif = (o: Partial<Notification>): Notification =>
  ({
    id: 1,
    type: "medal_granted",
    category: "account",
    data: {},
    actionable: false,
    resolution: null,
    actor: null,
    created_at: "2026-11-03T10:00:00Z",
    read: false,
    ...o,
  }) as Notification

describe("Para ti", () => {
  it("saluda según la hora", () => {
    expect(greeting(at(9))).toBe("Buenos días")
    expect(greeting(at(15))).toBe("Buenas tardes")
    expect(greeting(at(22))).toBe("Buenas noches")
    expect(greeting(at(3))).toBe("Buenas noches")
  })

  it("arma la fecha con mayúscula inicial", () => {
    expect(dateLabel(at(10))).toBe("Martes 3 de noviembre")
  })

  it("suma el ELO de los últimos 7 días", () => {
    const now = at(12)
    expect(
      weekDelta(
        [
          { at: "2026-10-20T12:00:00Z", elo_delta: 30 },
          { at: "2026-10-30T12:00:00Z", elo_delta: 16 },
          { at: "2026-11-02T12:00:00Z", elo_delta: -7 },
        ],
        now
      )
    ).toBe(9)
  })

  it("calcula el avance del nivel y no pasa del 10", () => {
    expect(levelProgress(5, 1102)).toEqual({ pct: 34, toNext: 99 })
    expect(levelProgress(10, 2400)).toEqual({ pct: 100, toNext: null })
  })

  it("% de victorias sin dividir por cero", () => {
    expect(winRate(9, 3)).toBe(75)
    expect(winRate(0, 0)).toBeNull()
  })

  it("ordena los pendientes: turno, respuesta y avisos; las leídas no van", () => {
    const list = pendingNotifications([
      notif({ id: 1, type: "medal_granted" }),
      notif({ id: 2, type: "team_invite", actionable: true, read: true }),
      notif({ id: 3, type: "veto_turn" }),
      notif({ id: 4, type: "level_changed", read: true }),
    ])
    expect(list.map((x) => x.n.id)).toEqual([3, 2, 1])
  })
})
