import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import { renderWithQuery, withSession } from "@/test/render"
import { API, profile, server, setupApi } from "../test/fixtures"
import { Compare } from "./Compare"

vi.mock("@tanstack/react-router", async (orig) =>
  (await import("../test/router")).mockRouter(orig)
)

setupApi()

// Las pruebas miran lo que ve el usuario con sesión (su fila, su perfil, su equipo).
withSession()

describe("Comparador", () => {
  const side = (alias: string, elo: number) => ({
    player: { id: alias, alias, photo_url: null },
    teams: [],
    game_role: "IGL",
    level: 5,
    elo,
    rating: 1.2,
    kd: 1.1,
    hs: 50,
    adr: 80,
    win_rate: 55,
    matches: 20,
    elo_matches: 20,
    elo_history: [1000, elo],
  })

  it("sin B pide elegir un jugador, con A por defecto el usuario", async () => {
    server.use(
      http.get(`${API}/api/v1/me/profile`, () => HttpResponse.json(profile))
    )
    renderWithQuery(<Compare search={{}} onChange={vi.fn()} />)
    expect(
      await screen.findByText("Elige un jugador para comparar con Zeta.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "Jugador A" })
    ).toHaveTextContent("Zeta")
  })

  it("muestra filas, gráfico y los mixes juntos y como rivales", async () => {
    server.use(
      http.get(`${API}/api/v1/me/profile`, () => HttpResponse.json(profile)),
      http.get(`${API}/api/v1/players/compare`, () =>
        HttpResponse.json({
          a: side("Zeta", 1200),
          b: side("kova", 1100),
          together: {
            same_team: { matches: 7, wins: 4 },
            against: { matches: 3, a_wins: 2 },
          },
        })
      )
    )
    renderWithQuery(<Compare search={{ b: "kova" }} onChange={vi.fn()} />)
    expect(
      await screen.findByRole("img", { name: /ELO de Zeta y kova/ })
    ).toBeInTheDocument()
    expect(screen.getByText(/Mixes jugados juntos:/)).toHaveTextContent(
      "Mixes jugados juntos: 7 · ganaron 4"
    )
    expect(screen.getByText(/Como rivales:/)).toHaveTextContent(
      "Como rivales: 3 · Zeta ganó 2"
    )
  })

  it("un jugador que no existe", async () => {
    server.use(
      http.get(`${API}/api/v1/me/profile`, () => HttpResponse.json(profile)),
      http.get(`${API}/api/v1/players/compare`, () =>
        HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "No existe" } },
          { status: 404 }
        )
      )
    )
    renderWithQuery(<Compare search={{ b: "nadie" }} onChange={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByText("Ese jugador no existe.")).toBeInTheDocument()
    )
  })
})
