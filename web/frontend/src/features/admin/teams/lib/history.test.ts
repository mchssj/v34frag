import { describe, expect, it } from "vitest"

import { historyText, staffNotice } from "./history"

const e = (action: string, data: Record<string, unknown> = {}) => ({
  action,
  data,
  actor_role: "team" as const,
})

describe("historyText", () => {
  it("una frase por acción", () => {
    expect(historyText(e("created", { name: "Kraken" }))).toBe(
      "creó el equipo «Kraken»"
    )
    expect(
      historyText(
        e("renamed", {
          old_name: "Malo",
          name: "Bueno",
          old_tag: "M",
          tag: "B",
        })
      )
    ).toBe("cambió el nombre de «Malo» a «Bueno»")
    expect(
      historyText(
        e("renamed", { old_name: "A", name: "A", old_tag: "X", tag: "Y" })
      )
    ).toBe("cambió la sigla de X a Y")
    expect(historyText(e("member_added", { player: "kz", role: "sub" }))).toBe(
      "sumó a kz como suplente"
    )
    expect(
      historyText(e("member_added", { player: "kz", role: "player" }))
    ).toBe("sumó a kz")
    expect(
      historyText(
        e("role_changed", { player: "kz", from: "sub", to: "player" })
      )
    ).toBe("pasó a kz de suplente a jugador")
    expect(historyText(e("captain_changed", { from: "a", to: "b" }))).toBe(
      "cambió el líder a b"
    )
    expect(historyText(e("member_left", { player: "kz" }))).toBe(
      "kz salió del equipo"
    )
    expect(historyText(e("algo_nuevo"))).toBe("algo_nuevo")
  })
})

describe("staffNotice", () => {
  it("lo que lee el líder", () => {
    expect(staffNotice("moderator", "rename")).toBe(
      "Un moderador cambió el nombre del equipo"
    )
    expect(staffNotice("admin", "kick", "vex")).toBe(
      "Un admin sacó a vex del equipo"
    )
  })
})
