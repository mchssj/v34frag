import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { KeyPlays } from "./KeyPlays"

const stats = {
  maps: 20,
  rounds: 472,
  kills: 428,
  deaths: 330,
  assists: 74,
  damage: 44676,
  rating: 1.24,
  kd: 1.3,
  hs: 54.9,
  adr: 94.7,
  wins: 10,
  losses: 10,
  k2: 24,
  k3: 10,
  k4: 3,
  k5: 1,
  first_kills: 54,
  first_deaths: 46,
  plants: 31,
  defuses: 7,
  clutches: { 1: 9, 2: 4, 3: 1, 4: 1, 5: 0 },
}

describe("Jugadas clave", () => {
  it("multi-kills, entradas, clutches y objetivos", () => {
    render(<KeyPlays stats={stats} />)
    expect(screen.getByText("Jugadas clave")).toBeInTheDocument()
    expect(screen.getByText("5k · ace")).toBeInTheDocument()
    // (24 + 10 + 3 + 1) / 20 partidas.
    expect(screen.getByText("1.9 por partida")).toBeInTheDocument()
    // 54 de 100 entradas; 100 entradas en 472 rondas.
    expect(screen.getByText("54%")).toBeInTheDocument()
    expect(screen.getByText("0.21")).toBeInTheDocument()
    expect(screen.getByText("15")).toBeInTheDocument()
    // El 1v4 en el color primario si lo tiene; el 1v5 en 0, apagado.
    expect(screen.getByText("1v4").previousElementSibling).toHaveClass(
      "text-primary"
    )
    expect(screen.getByText("1v5").previousElementSibling).toHaveClass(
      "text-muted-foreground"
    )
    expect(screen.getByText("31")).toBeInTheDocument()
    expect(screen.getByText("7")).toBeInTheDocument()
  })

  it("sin partidas", () => {
    render(<KeyPlays stats={{ ...stats, maps: 0 }} />)
    expect(
      screen.getByText("Todavía no jugó partidas en el servidor.")
    ).toBeInTheDocument()
  })
})
