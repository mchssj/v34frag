import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { renderWithQuery } from "@/test/render"
import { HudCard } from "./HudCard"

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

const posted = vi.fn()
const TOKEN = "hud_" + "f".repeat(64)
function api() {
  server.use(
    http.post(`${API}/api/v1/me/hud-link`, () => {
      posted()
      return HttpResponse.json({
        hud_url: `https://hud.cmleague.lat/s/${TOKEN}/hud`,
        control_url: `https://hud.cmleague.lat/s/${TOKEN}/control`,
        created_at: "2026-10-29T18:00:00Z",
      })
    }),
    http.get(`${API}/api/v1/me/profile`, () => HttpResponse.json({}))
  )
}

describe("HUD para OBS", () => {
  it("sin link: lo genera y muestra los dos links una vez", async () => {
    api()
    const { user } = renderWithQuery(
      <HudCard
        streamer={{
          since: "2026-10-29T15:00:00Z",
          has_link: false,
          link_created_at: null,
        }}
      />
    )
    await user.click(screen.getByRole("button", { name: "Generar mi link" }))
    await waitFor(() => expect(posted).toHaveBeenCalledTimes(1))
    expect(
      await screen.findByText(`https://hud.cmleague.lat/s/${TOKEN}/hud`)
    ).toBeInTheDocument()
    expect(
      screen.getByText(`https://hud.cmleague.lat/s/${TOKEN}/control`)
    ).toBeInTheDocument()
    expect(screen.getByText(/no se vuelve a mostrar/)).toBeInTheDocument()
  })

  it("con link: pide confirmación antes de generar otro", async () => {
    api()
    const { user } = renderWithQuery(
      <HudCard
        streamer={{
          since: "2026-10-29T15:00:00Z",
          has_link: true,
          link_created_at: "2026-10-29T17:30:00Z",
        }}
      />
    )
    await user.click(screen.getByRole("button", { name: "Generar otro link" }))
    expect(posted).not.toHaveBeenCalled()
    expect(screen.getByText(/deja de andar en 30 segundos/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Generar otro" }))
    await waitFor(() => expect(posted).toHaveBeenCalledTimes(1))
  })
})
