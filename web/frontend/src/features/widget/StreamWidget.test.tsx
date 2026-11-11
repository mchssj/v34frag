import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StreamWidget, type WidgetData } from "./StreamWidget"
import type { Part } from "./options"

// La foto del perfil en el widget (bitácora 2026-11-11-widget-foto-de-perfil).

const DATA: WidgetData = {
  nick: "mecha",
  team_tag: null,
  country: null,
  photo_url: null,
  elo: 1180,
  peak_elo: 1240,
  rank: 7,
  country_rank: null,
  period: {
    v: 0,
    d: 0,
    e: 0,
    elo: 0,
    kills: 0,
    deaths: 0,
    rounds: 0,
    damage: 0,
    headshots: 0,
    k3: 0,
    k4: 0,
    k5: 0,
    sniper: 0,
    knife: 0,
    clutches: 0,
    entries: 0,
    pistols: 0,
    rating: null,
  },
  ultimos: [],
}

const show = (hidden: Part[] = [], data: Partial<WidgetData> = {}) =>
  render(
    <StreamWidget
      data={{ ...DATA, ...data }}
      options={{ design: "mini", hidden }}
    />
  )

describe("foto del perfil en el widget", () => {
  it("de fábrica: la inicial dentro del anillo y el nivel en la pastilla", () => {
    const { container } = show()
    const ring = screen.getByRole("img", { name: "Nivel 5" })
    expect(ring.querySelector("text")).toBeNull()
    expect(screen.getByText("M")).toBeInTheDocument()
    expect(container.querySelector("span[aria-hidden]")).not.toBeNull()
    expect(screen.getByText("5")).toBeInTheDocument()
  })

  it("con la foto apagada: el anillo con el número adentro, como antes", () => {
    show(["photo"])
    const ring = screen.getByRole("img", { name: "Nivel 5" })
    expect(ring.querySelector("text")).toHaveTextContent("5")
    expect(screen.queryByText("M")).toBeNull()
  })

  it("con el nivel oculto: solo la foto", () => {
    show(["level"])
    expect(screen.queryByRole("img", { name: "Nivel 5" })).toBeNull()
    expect(screen.getByText("M")).toBeInTheDocument()
  })

  it("con las dos ocultas: ni foto ni nivel", () => {
    show(["photo", "level"])
    expect(screen.queryByRole("img", { name: "Nivel 5" })).toBeNull()
    expect(screen.queryByText("M")).toBeNull()
  })

  it("en los seis diseños se dibuja la foto", () => {
    for (const design of [
      "mini",
      "compacto",
      "completo",
      "stats",
      "barra",
      "vertical",
    ] as const) {
      const { unmount } = render(
        <StreamWidget data={DATA} options={{ design }} />
      )
      expect(screen.getByText("M"), design).toBeInTheDocument()
      unmount()
    }
  })
})
