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
      await screen.findByText("No hay IPs baneadas desde los servidores.")
    ).toBeInTheDocument()
  })
})
