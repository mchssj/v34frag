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
import { ServerIpBansPanel } from "./ServerIpBansPanel"

// Baneos por IP del servidor, sin ficha (replanteo 151, docs/bitacora/2026-11-26-baneos-en-los-servidores).
const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ID = "33333333-3333-4333-8333-333333333333"
const PLAYER_OK = "dddddddd-0000-4000-8000-000000000001"
const PLAYER_BAN = "dddddddd-0000-4000-8000-000000000002"
const page = (items: unknown[]) => ({
  items,
  total: items.length,
  page: 1,
  per: 100,
  sort: "created_at",
  order: "desc",
})

describe("ServerIpBansPanel", () => {
  it("muestra los !banip con motivo, quién, servidor y permanente, y los levanta", async () => {
    const lifted = vi.fn()
    server.use(
      http.get(`${API}/api/v1/admin/ban-ips`, () =>
        HttpResponse.json(
          page([
            {
              id: ID,
              ip: "203.0.113.0/24",
              reason: "Cheats",
              expires_at: null,
              created_at: "2026-11-26T20:00:00Z",
              created_by_name: "Daniel",
              server_name: "Server CM League #1",
              active: true,
              exceptions: [],
            },
          ])
        )
      ),
      http.delete(`${API}/api/v1/admin/ban-ips/:id`, ({ params }) => {
        lifted(params.id)
        return new HttpResponse(null, { status: 204 })
      })
    )
    renderWithQuery(<ServerIpBansPanel />)
    expect(await screen.findByText("203.0.113.0/24")).toBeInTheDocument()
    expect(screen.getByText("permanente")).toBeInTheDocument()
    expect(
      screen.getByText(/Motivo: Cheats · por Daniel · en Server CM League #1/)
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole("button", { name: "Levantar 203.0.113.0/24" })
    )
    await waitFor(() => expect(lifted).toHaveBeenCalledWith(ID))
  })

  it("sin baneos lo dice", async () => {
    server.use(
      http.get(`${API}/api/v1/admin/ban-ips`, () => HttpResponse.json(page([])))
    )
    renderWithQuery(<ServerIpBansPanel />)
    expect(
      await screen.findByText("No hay IPs baneadas sin ficha.")
    ).toBeInTheDocument()
  })

  it("banea un rango sin ficha: revisa a quién alcanza, exceptúa a los no baneados y manda motivo y duración", async () => {
    const posted = vi.fn()
    server.use(
      http.get(`${API}/api/v1/admin/ban-ips`, () =>
        HttpResponse.json(page([]))
      ),
      http.get(`${API}/api/v1/admin/ip-ranges/accounts`, () =>
        HttpResponse.json(
          page([
            {
              player_id: PLAYER_OK,
              user_id: null,
              alias: "GabeV",
              sources: ["web"],
              ips: 5,
              last_seen_at: "2026-11-26T00:00:00Z",
              banned: false,
            },
            {
              player_id: PLAYER_BAN,
              user_id: null,
              alias: "Nose",
              sources: ["servidor"],
              ips: 2,
              last_seen_at: "2026-11-26T00:00:00Z",
              banned: true,
            },
          ])
        )
      ),
      http.post(`${API}/api/v1/admin/ban-ips`, async ({ request }) => {
        posted(await request.json())
        return HttpResponse.json({ id: ID }, { status: 201 })
      })
    )
    renderWithQuery(<ServerIpBansPanel />)
    await userEvent.click(
      await screen.findByRole("button", { name: "Banear IP o rango" })
    )
    await userEvent.type(screen.getByLabelText("IP o rango"), "181.21.0.0/16")
    await userEvent.click(screen.getByRole("button", { name: "Revisar" }))
    expect(await screen.findByText("GabeV")).toBeInTheDocument()
    expect(
      screen.getByRole("checkbox", { name: "Exceptuar a GabeV" })
    ).toBeChecked()
    expect(
      screen.getByRole("checkbox", { name: "Exceptuar a Nose" })
    ).not.toBeChecked()
    const ban = screen.getByRole("button", { name: "Banear 181.21.0.0/16" })
    expect(ban).toBeDisabled()
    await userEvent.type(screen.getByLabelText("Motivo"), "Cuentas del cheater")
    await userEvent.click(ban)
    await waitFor(() =>
      expect(posted).toHaveBeenCalledWith({
        ip: "181.21.0.0/16",
        reason: "Cuentas del cheater",
        minutes: 1440,
        except_players: [PLAYER_OK],
        except_users: [],
      })
    )
  })

  it("permanente: manda 0 minutos", async () => {
    const posted = vi.fn()
    server.use(
      http.get(`${API}/api/v1/admin/ban-ips`, () =>
        HttpResponse.json(page([]))
      ),
      http.get(`${API}/api/v1/admin/ip-ranges/accounts`, () =>
        HttpResponse.json(page([]))
      ),
      http.post(`${API}/api/v1/admin/ban-ips`, async ({ request }) => {
        posted(await request.json())
        return HttpResponse.json({ id: ID }, { status: 201 })
      })
    )
    renderWithQuery(<ServerIpBansPanel />)
    await userEvent.click(
      await screen.findByRole("button", { name: "Banear IP o rango" })
    )
    await userEvent.type(screen.getByLabelText("IP o rango"), "203.0.113.0/24")
    await userEvent.type(screen.getByLabelText("Motivo"), "Cheater")
    await userEvent.click(screen.getByRole("combobox", { name: "Duración" }))
    await userEvent.click(
      await screen.findByRole("option", { name: "Permanente" })
    )
    await userEvent.click(screen.getByRole("button", { name: "Revisar" }))
    await userEvent.click(
      await screen.findByRole("button", { name: "Banear 203.0.113.0/24" })
    )
    await waitFor(() =>
      expect(posted).toHaveBeenCalledWith(
        expect.objectContaining({ minutes: 0 })
      )
    )
  })
})
