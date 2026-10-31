import { describe, expect, it } from "vitest"

import { hudChip, parseHudPort } from "./hud"
import { server } from "./test-server"
import type { AdminServer } from "../types"

describe("HUD de un servidor", () => {
  const hud = (o: Partial<AdminServer["hud"]>) => ({ ...server().hud, ...o })

  it("el chip dice si tiene HUD, si está prendido y si llegan paquetes", () => {
    expect(hudChip(hud({}))).toEqual({ text: "Sin HUD", tone: "neutral" })
    expect(hudChip(hud({ port: 27502 }))).toEqual({
      text: "Apagado · 27502",
      tone: "neutral",
    })
    expect(hudChip(hud({ port: 27501, enabled: true }))).toEqual({
      text: "Activo · sin señal",
      tone: "warn",
    })
    expect(
      hudChip(hud({ port: 27501, enabled: true, receiving: true }))
    ).toEqual({ text: "Recibiendo", tone: "win" })
  })

  it("el puerto va del 27500 al 27519; vacío saca el HUD", () => {
    expect(parseHudPort("27501")).toEqual({ port: 27501 })
    expect(parseHudPort(" ")).toEqual({ port: null })
    expect(parseHudPort("27520")).toHaveProperty("error")
    expect(parseHudPort("2750a")).toHaveProperty("error")
  })
})
