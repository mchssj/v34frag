import { subMinutes } from "date-fns"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { mockNotifications } from "./mock"
import { filterByTab, timeAgo, useNotifications } from "./model"

describe("notificaciones", () => {
  it("los tabs filtran sin leer y solicitudes (invitaciones y PCW)", () => {
    const items = mockNotifications()
    expect(filterByTab(items, "all")).toHaveLength(items.length)
    expect(filterByTab(items, "unread").every((n) => !n.read)).toBe(true)
    expect(filterByTab(items, "requests").map((n) => n.kind)).toEqual([
      "invite",
      "pcw",
    ])
  })

  it("PCW y veto solo para capitanes (o admin)", () => {
    const { result } = renderHook(() => useNotifications({ captain: false }))
    expect(
      result.current.items.some((n) => n.kind === "pcw" || n.kind === "veto")
    ).toBe(false)
  })

  it("marcar leídas y resolver una solicitud", () => {
    const { result } = renderHook(() => useNotifications({ captain: true }))
    const before = result.current.unread
    act(() => result.current.markRead("n1"))
    expect(result.current.unread).toBe(before - 1)
    act(() => result.current.resolve("n2", "rejected"))
    expect(result.current.items.find((n) => n.id === "n2")).toMatchObject({
      resolution: "rejected",
      read: true,
    })
    act(() => result.current.markAllRead())
    expect(result.current.unread).toBe(0)
  })

  it("tiempo relativo", () => {
    const now = new Date(2026, 9, 18, 12, 0)
    const ago = (m: number) => subMinutes(now, m).toISOString()
    expect(timeAgo(ago(5), now)).toBe("hace 5 minutos")
    expect(timeAgo(ago(180), now)).toBe("hace 3 horas")
    expect(timeAgo(ago(60 * 24), now)).toBe("ayer")
    expect(timeAgo(ago(60 * 24 * 4), now)).toBe("hace 4 días")
  })
})
