import { screen, within } from "@testing-library/react"
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

import { renderWithRouter } from "@/test/renderWithRouter"
import { ProfileVisitsCard } from "./ProfileVisitsCard"

// Visitas a tu perfil (replanteo 86).
const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const visitor = (nick: string, i: number) => ({
  player_id: `00000000-0000-4000-8000-00000000000${i}`,
  nick,
  photo_url: null,
  level: 5,
  visited_at: new Date(Date.now() - i * 3_600_000).toISOString(),
})

describe("visitas a tu perfil", () => {
  it("sin VIP: el número, siluetas y Ser VIP; ningún nick", async () => {
    server.use(
      http.get(`${API}/api/v1/me/profile-visits`, () =>
        HttpResponse.json({
          vip: false,
          total: 4,
          week: 2,
          items: null,
          incognito: null,
        })
      )
    )
    const { user } = await renderWithRouter(<ProfileVisitsCard />)
    expect(await screen.findByText("4")).toBeInTheDocument()
    expect(screen.getByText("2 esta semana")).toBeInTheDocument()
    expect(screen.queryAllByRole("link")).toHaveLength(0)
    await user.click(screen.getByRole("button", { name: "Ser VIP" }))
    expect(
      await screen.findByText(/Comunícate con uno de nuestros administradores/)
    ).toBeInTheDocument()
  })

  it("con VIP: quiénes, las últimas y el modo oculto con su cupo", async () => {
    const put = vi.fn()
    const items = ["romanxz", "rei", "flow", "aciart"].map(visitor)
    const body = (enabled: boolean) => ({
      vip: true,
      total: 4,
      week: 4,
      items,
      incognito: {
        enabled,
        used: 4,
        limit: 15,
        resets_at: "2026-11-09T05:00:00Z",
      },
    })
    server.use(
      http.get(`${API}/api/v1/me/profile-visits`, () =>
        HttpResponse.json(body(false))
      ),
      http.put(
        `${API}/api/v1/me/profile-visits/incognito`,
        async ({ request }) => {
          put(await request.json())
          return HttpResponse.json(body(true))
        }
      )
    )
    const { user } = await renderWithRouter(<ProfileVisitsCard />)
    expect(
      await screen.findByRole("link", { name: "Ver el perfil de romanxz" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("switch"))
    expect(put).toHaveBeenCalledWith({ enabled: true })
    expect(
      await screen.findByText(/puedes ver 11 perfiles más/)
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: "Ver todas las visitas" })
    )
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getAllByRole("link")).toHaveLength(4)
  })
})
