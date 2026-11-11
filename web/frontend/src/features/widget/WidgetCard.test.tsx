import { screen, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { renderWithRouter } from "@/test/renderWithRouter"
import { WidgetCard } from "./WidgetCard"

const API = "http://api.test"
const ID = "22222222-2222-4222-8222-222222222222"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const period = {
  v: 1,
  d: 0,
  e: 0,
  elo: 12,
  kills: 20,
  deaths: 14,
  rounds: 22,
  damage: 2100,
  headshots: 9,
  k3: 1,
  k4: 0,
  k5: 0,
  sniper: 0,
  knife: 0,
  clutches: 0,
  entries: 3,
  pistols: 1,
  rating: 1.08,
}

describe("Widget para stream en Cuenta", () => {
  it("sin ficha: el botón está apagado y explica cómo vincularla", async () => {
    await renderWithRouter(<WidgetCard playerId={null} />)
    expect(
      await screen.findByRole("button", { name: "Armar mi widget" })
    ).toBeDisabled()
    expect(
      screen.getByRole("link", { name: "vincúlala con !claim" })
    ).toBeInTheDocument()
  })

  it("con ficha: vista previa con sus datos y la URL cambia con lo que elige", async () => {
    server.use(
      http.get(`${API}/api/v1/players/${ID}/widget`, () =>
        HttpResponse.json({
          id: ID,
          nick: "Mecha",
          team_tag: null,
          country: null,
          elo: 1100,
          peak_elo: 1100,
          rank: 30,
          country_rank: null,
          period,
          ultimos: [{ r: "V", elo: 12 }],
        })
      )
    )
    const { user } = await renderWithRouter(<WidgetCard playerId={ID} />)
    await user.click(
      await screen.findByRole("button", { name: "Armar mi widget" })
    )
    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByText("Mecha")).toBeInTheDocument()

    const url = within(dialog).getByRole("textbox", { name: "URL del widget" })
    expect(url).toHaveValue(`${location.origin}/widget?id=${ID}`)

    await user.click(within(dialog).getByRole("radio", { name: "Stats" }))
    await user.click(within(dialog).getByRole("radio", { name: "Histórico" }))
    expect(url).toHaveValue(
      `${location.origin}/widget?id=${ID}&d=stats&v=historico`
    )
  })
})
