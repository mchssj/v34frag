import { screen, waitFor, within } from "@testing-library/react"
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

const stats = {
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

  it("con ficha: abre con lo guardado, la URL es fija y Guardar manda los cambios", async () => {
    let settings: string | null = "d=stats&v=historico"
    let period: string | null | undefined
    const saved: unknown[] = []
    server.use(
      http.get(`${API}/api/v1/players/${ID}/widget`, ({ request }) => {
        period = new URL(request.url).searchParams.get("period")
        return HttpResponse.json({
          id: ID,
          nick: "Mecha",
          team_tag: null,
          country: null,
          photo_url: null,
          elo: 1100,
          peak_elo: 1100,
          rank: 30,
          country_rank: null,
          period: stats,
          ultimos: [{ r: "V", elo: 12 }],
          settings,
        })
      }),
      http.put(`${API}/api/v1/me/widget`, async ({ request }) => {
        const body = (await request.json()) as { query: string }
        saved.push(body)
        settings = body.query
        return HttpResponse.json({
          query: body.query,
          updated_at: "2026-11-11T18:00:00Z",
        })
      })
    )
    const { user } = await renderWithRouter(<WidgetCard playerId={ID} />)
    await user.click(
      await screen.findByRole("button", { name: "Armar mi widget" })
    )
    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByText("Mecha")).toBeInTheDocument()
    // La primera consulta no manda período: la API usa el guardado.
    expect(period).toBeNull()
    expect(within(dialog).getByRole("radio", { name: "Stats" })).toBeChecked()
    expect(
      within(dialog).getByRole("radio", { name: "Histórico" })
    ).toBeChecked()

    const url = within(dialog).getByRole("textbox", { name: "URL del widget" })
    expect(url).toHaveValue(`${location.origin}/widget?id=${ID}`)
    const guardar = within(dialog).getByRole("button", { name: "Guardar" })
    expect(guardar).toBeDisabled()

    await user.click(within(dialog).getByRole("radio", { name: "Barra" }))
    expect(within(dialog).getByText("Cambios sin guardar")).toBeInTheDocument()
    expect(url).toHaveValue(`${location.origin}/widget?id=${ID}`)
    await user.click(guardar)

    await waitFor(() =>
      expect(within(dialog).queryByText("Cambios sin guardar")).toBeNull()
    )
    expect(saved).toEqual([{ query: "d=barra&v=historico" }])
    expect(guardar).toBeDisabled()
  })

  it("cerrar con cambios sin guardar pide confirmación", async () => {
    server.use(
      http.get(`${API}/api/v1/players/${ID}/widget`, () =>
        HttpResponse.json({
          id: ID,
          nick: "Mecha",
          team_tag: null,
          country: null,
          photo_url: null,
          elo: 1100,
          peak_elo: 1100,
          rank: 30,
          country_rank: null,
          period: stats,
          ultimos: [],
          settings: null,
        })
      )
    )
    const { user } = await renderWithRouter(<WidgetCard playerId={ID} />)
    await user.click(
      await screen.findByRole("button", { name: "Armar mi widget" })
    )
    const dialog = await screen.findByRole("dialog")
    await within(dialog).findByText("Mecha")
    await user.click(within(dialog).getByRole("radio", { name: "Mini" }))
    await user.keyboard("{Escape}")
    expect(
      await screen.findByRole("alertdialog", { name: "¿Cerrar sin guardar?" })
    ).toBeInTheDocument()
  })
})
