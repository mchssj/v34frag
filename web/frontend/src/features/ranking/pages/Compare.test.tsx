import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import { renderWithQuery } from "@/test/render"
import { API, profile, server, setupApi } from "../test/fixtures"
import { Compare } from "./Compare"

vi.mock("@tanstack/react-router", async (orig) =>
  (await import("../test/router")).mockRouter(orig)
)

setupApi()

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

  const together = {
    same_team: { matches: 7, wins: 4 },
    against: { matches: 3, a_wins: 2 },
  }
  const vipProfile = {
    ...profile,
    vip: { active: true, lifetime: true, until: null, since: "2026-10-26" },
  }

  it("con VIP compara hasta cinco: columnas, gráfico y los mixes con A", async () => {
    const asked = vi.fn()
    const onChange = vi.fn()
    server.use(
      http.get(`${API}/api/v1/me/profile`, () => HttpResponse.json(vipProfile)),
      http.get(`${API}/api/v1/players/compare`, ({ request }) => {
        asked(Object.fromEntries(new URL(request.url).searchParams))
        return HttpResponse.json({
          a: side("Zeta", 1200),
          b: side("kova", 1100),
          together,
          others: [{ player: side("fako", 1300), together }],
        })
      })
    )
    const search = { b: "kova", d: "fako" }
    const { user } = renderWithQuery(
      <Compare search={search} onChange={onChange} />
    )
    expect(
      await screen.findByRole("img", { name: /ELO de Zeta, kova y fako/ })
    ).toBeInTheDocument()
    expect(asked).toHaveBeenLastCalledWith({ a: "Zeta", b: "kova", c: "fako" })
    expect(screen.getAllByRole("columnheader")).toHaveLength(4)
    expect(screen.getByText("Con fako")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Agregar jugador" })
    ).toBeInTheDocument()
    // Solo se quitan los agregados, y cada uno deja su letra.
    expect(
      screen.queryByRole("button", { name: "Quitar a kova" })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Quitar a fako" }))
    expect(onChange).toHaveBeenCalledWith({ b: "kova", d: undefined })
  })

  it("sin VIP, un link con más se compara con los dos primeros y avisa", async () => {
    const asked = vi.fn()
    server.use(
      http.get(`${API}/api/v1/me/profile`, () => HttpResponse.json(profile)),
      http.get(`${API}/api/v1/players/compare`, ({ request }) => {
        asked(Object.fromEntries(new URL(request.url).searchParams))
        return HttpResponse.json({
          a: side("Zeta", 1200),
          b: side("kova", 1100),
          together,
          others: [],
        })
      })
    )
    const { user } = renderWithQuery(
      <Compare
        search={{ b: "kova", c: "fako", d: "KOVA" }}
        onChange={vi.fn()}
      />
    )
    expect(
      await screen.findByText(/El link trae 3 jugadores/)
    ).toBeInTheDocument()
    await screen.findByRole("img", { name: /ELO de Zeta y kova/ })
    expect(asked).toHaveBeenLastCalledWith({ a: "Zeta", b: "kova" })
    await user.click(
      screen.getByRole("button", { name: /Con VIP comparas hasta 5/ })
    )
    expect(
      await screen.findByRole("dialog", { name: "Cómo ser VIP" })
    ).toBeInTheDocument()
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
          together,
          others: [],
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
