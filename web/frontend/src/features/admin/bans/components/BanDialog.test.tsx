import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
import { BanDialog } from "./BanDialog"

// Banear una cuenta sin ficha (2026-11-26, bitácora 2026-11-26-banear-cuenta-sin-ficha).
const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

const USER = "11111111-1111-4111-8111-111111111111"
const PLAYER = "22222222-2222-4222-8222-222222222222"
const page = (items: unknown[]) => ({
  items,
  total: items.length,
  page: 1,
  per: 25,
  sort: "alias",
  order: "asc",
})
const ban = {
  id: "33333333-3333-4333-8333-333333333333",
  player: { id: PLAYER, alias: "Tormenta" },
  nick: null,
  steam_id: null,
  reason: "Multicuenta",
  permanent: true,
  expires_at: null,
  status: "active",
}
const order: string[] = []
const createdPlayer = vi.fn()
const createdBan = vi.fn()

function api() {
  server.use(
    http.get(`${API}/api/v1/players`, () => HttpResponse.json(page([]))),
    http.get(`${API}/api/v1/bans`, () => HttpResponse.json(page([]))),
    http.get(`${API}/api/v1/admin/users`, ({ request }) => {
      const q = new URL(request.url).searchParams
      expect(q.get("has_player")).toBe("false")
      return HttpResponse.json(
        page([
          {
            id: USER,
            alias: "Tormenta",
            role: "user",
            alias_changed_at: null,
            player_id: null,
            steam_id: null,
            vip: null,
            streamer: false,
          },
        ])
      )
    }),
    http.post(`${API}/api/v1/admin/players`, async ({ request }) => {
      order.push("ficha")
      createdPlayer(await request.json())
      return HttpResponse.json(
        { id: PLAYER, nick: "Tormenta" },
        { status: 201 }
      )
    }),
    http.post(`${API}/api/v1/admin/bans`, async ({ request }) => {
      order.push("baneo")
      createdBan(await request.json())
      return HttpResponse.json(ban, { status: 201 })
    })
  )
}

describe("BanDialog: cuenta sin ficha", () => {
  it("la busca, le crea la ficha y después la banea", async () => {
    api()
    renderWithQuery(<BanDialog canPermanent accounts onClose={vi.fn()} />)
    await userEvent.type(screen.getByLabelText("Jugador o SteamID"), "Torm")
    await userEvent.click(
      await screen.findByRole("radio", { name: /Tormenta/ })
    )
    await userEvent.type(screen.getByLabelText(/Motivo/), "Multicuenta")
    await userEvent.click(screen.getByText("Permanente"))
    await userEvent.click(screen.getByRole("button", { name: "Banear" }))
    await waitFor(() => expect(createdBan).toHaveBeenCalled())
    expect(order).toEqual(["ficha", "baneo"])
    expect(createdPlayer).toHaveBeenCalledWith({
      nick: "Tormenta",
      user_id: USER,
      force: false,
    })
    expect(createdBan).toHaveBeenCalledWith({
      reason: "Multicuenta",
      permanent: true,
      player_id: PLAYER,
    })
  })

  it("el aviso ya no promete echarlo de los servidores", () => {
    api()
    renderWithQuery(<BanDialog canPermanent onClose={vi.fn()} />)
    expect(
      screen.getByText(/Lo saca de la cola del matchmaking/)
    ).toBeInTheDocument()
    expect(screen.queryByText(/syncbans/)).not.toBeInTheDocument()
  })
})
