import { describe, expect, it } from "vitest"

import type { Booking, MatchBooking } from "../types/booking"
import { booking } from "./booking.fixture"
import {
  clock,
  endedText,
  extendRoom,
  isOpen,
  secondsLeft,
  statusLine,
} from "./booking"

const NOW = Date.parse("2026-11-02T20:00:00Z")
const names: [string, string] = ["Alfa", "Beta"]

const mb = (
  b: Booking | null,
  extra: Partial<MatchBooking> = {}
): MatchBooking => ({
  kind: b?.kind ?? "official",
  veto_done: true,
  can_veto: false,
  veto_turn_seconds: 30,
  maps: ["de_dust2"],
  my_side: 0,
  can_manage: false,
  can_start: false,
  can_ready: false,
  ban_until: null,
  booking: b,
  ...extra,
})

describe("reloj", () => {
  it("cuenta los segundos que faltan y no baja de cero", () => {
    expect(secondsLeft("2026-11-02T20:01:05Z", NOW)).toBe(65)
    expect(secondsLeft("2026-11-02T19:59:00Z", NOW)).toBe(0)
    expect(secondsLeft(null, NOW)).toBe(0)
    expect(clock(65)).toBe("1:05")
    expect(clock(9)).toBe("0:09")
  })
})

describe("isOpen", () => {
  it("solo los estados de una reserva en curso", () => {
    expect(isOpen(booking({ status: "veto" }))).toBe(true)
    expect(isOpen(booking({ status: "lost" }))).toBe(true)
    expect(isOpen(booking({ status: "finished" }))).toBe(false)
    expect(isOpen(null)).toBe(false)
  })
})

describe("extendRoom", () => {
  it("no deja pasar de 20 minutos desde que empezó la espera", () => {
    const b = booking({
      wait_started_at: "2026-11-02T19:45:00Z",
      wait_deadline: "2026-11-02T19:55:00Z",
    })
    // Empezó hace 15 min y ya venció: quedan 5.
    expect(extendRoom(b, NOW)).toBe(5)
    expect(
      extendRoom(booking({ wait_started_at: "2026-11-02T19:40:00Z" }), NOW)
    ).toBe(0)
    expect(extendRoom(booking(), NOW)).toBe(0)
  })
})

describe("statusLine", () => {
  it("dice qué falta en cada estado", () => {
    expect(
      statusLine(
        mb(
          booking({ status: "ready", kind: "pcw", ready1: true, ready2: false })
        ),
        names
      )
    ).toBe("Falta que Beta se marque listo.")
    expect(
      statusLine(
        mb(booking({ status: "queued", kind: "pcw", queue_position: 2 })),
        names
      )
    ).toContain("puesto 2")
    expect(
      statusLine(mb(booking({ status: "assigned", taken: false })), names)
    ).toContain("tomando la partida")
    expect(statusLine(mb(booking({ status: "live", map_no: 2 })), names)).toBe(
      "Mapa 2 en juego en CMLeague #1."
    )
    expect(statusLine(mb(booking({ status: "finished" })), names)).toBeNull()
  })
})

describe("endedText", () => {
  it("explica el abandono y la cancelación", () => {
    expect(
      endedText(booking({ status: "abandoned", abandoned_side: 2 }), names)
    ).toContain("Beta no se presentó")
    expect(
      endedText(booking({ status: "abandoned", abandoned_side: 3 }), names)
    ).toContain("Ninguno de los dos")
    expect(
      endedText(
        booking({ status: "cancelled", end_reason: "server_lost" }),
        names
      )
    ).toContain("dejó de responder")
    expect(
      endedText(
        booking({
          status: "cancelled",
          end_reason: "server: El servidor no tiene el mapa",
        }),
        names
      )
    ).toContain("no tiene el mapa")
    expect(endedText(booking({ status: "finished" }), names)).toBeNull()
  })
})
