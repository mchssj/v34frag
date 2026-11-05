import { screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import { renderWithQuery, withSession } from "@/test/render"
import { API, page, profile, server, setupApi } from "../test/fixtures"
import { TeamsRanking } from "./TeamsRanking"

vi.mock("@tanstack/react-router", async (orig) =>
  (await import("../test/router")).mockRouter(orig)
)

setupApi()

// Las pruebas miran lo que ve el usuario con sesión (su fila, su perfil, su equipo).
withSession()

describe("Ranking → Equipos", () => {
  const team = (name: string, id: string, o: Record<string, unknown> = {}) => ({
    position: 1,
    team: { id, name, tag: name.slice(0, 3).toUpperCase() },
    played: 10,
    won: 7,
    lost: 3,
    points: 210,
    win_rate: 70,
    trend: 2,
    form: ["W", "L", "W", "W", "W"],
    ...o,
  })

  it("marca todos los equipos del usuario y arma la leyenda con los puntos de la API", async () => {
    server.use(
      http.get(`${API}/api/v1/me/profile`, () => HttpResponse.json(profile)),
      http.get(`${API}/api/v1/ranking/teams`, ({ request }) => {
        const pcw = new URL(request.url).searchParams.get("pcw") === "1"
        return HttpResponse.json({
          ...page([
            team("GO TO KNOW", "t1"),
            team("Brava", "t2", { trend: null }),
            team("Kraken", "t9", { trend: -1 }),
          ]),
          pcw,
          points_per_win: { official: 30, pcw: 5 },
        })
      })
    )
    renderWithQuery(
      <TooltipProvider>
        <TeamsRanking search={{ pcw: true }} onChange={vi.fn()} />
      </TooltipProvider>
    )

    expect(await screen.findAllByText("TU EQUIPO")).toHaveLength(2)
    expect(
      screen.getByText(
        "Puntos por partida ganada en torneos y en PCW jugadas como equipo oficial."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "30 pts por partida de torneo ganada · 5 pts por PCW ganada como equipo oficial"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Hace 30 días: 3.º")).toBeInTheDocument()
    expect(screen.getByText("Sin partidas hace 30 días")).toBeInTheDocument()
  })
})
