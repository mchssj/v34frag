import { screen, waitFor, within } from "@testing-library/react"
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
import { StreamerSection } from "./AccountsTab"
import type { AdminUser } from "./queries"

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

const ID = "22222222-2222-4222-8222-222222222222"
const user = (o: Partial<AdminUser> = {}): AdminUser => ({
  id: ID,
  alias: "kyantares",
  role: "admin",
  alias_changed_at: null,
  player_id: null,
  steam_id: null,
  vip: null,
  streamer: false,
  ...o,
})
const marca = {
  user: { id: ID, alias: "kyantares" },
  active: true,
  granted_at: "2026-10-29T15:00:00Z",
  granted_by: "Daniel",
  revoked_at: null,
  has_link: true,
  link_created_at: "2026-10-29T17:30:00Z",
}

const calls = vi.fn()
function api(items: unknown[]) {
  server.use(
    http.get(`${API}/api/v1/admin/streamers`, ({ request }) => {
      calls(new URL(request.url).searchParams.get("q"))
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        per: 100,
      })
    }),
    http.post(`${API}/api/v1/admin/users/:id/streamer`, () => {
      calls("grant")
      return HttpResponse.json(marca)
    }),
    http.post(`${API}/api/v1/admin/users/:id/streamer/revoke`, () => {
      calls("revoke")
      return HttpResponse.json({ ...marca, active: false })
    })
  )
}

describe("marca de streamer", () => {
  it("con la marca: desde cuándo, quién la dio y el link", async () => {
    api([marca])
    renderWithQuery(<StreamerSection u={user({ streamer: true })} />)
    expect(await screen.findByText(/Desde el 29 oct 2026/)).toBeInTheDocument()
    expect(
      screen.getByText(/Se la dio Daniel\. Generó su link el 29 oct 2026/)
    ).toBeInTheDocument()
    expect(calls).toHaveBeenCalledWith("kyantares")
  })

  it("dar la marca pide confirmación y llama a la API", async () => {
    api([])
    const { user: u } = renderWithQuery(<StreamerSection u={user()} />)
    expect(screen.getByText("No")).toBeInTheDocument()
    await u.click(screen.getByRole("button", { name: "Dar streamer" }))
    expect(calls).not.toHaveBeenCalledWith("grant")
    const dialog = await screen.findByRole("dialog")
    await u.click(within(dialog).getByRole("button", { name: "Dar streamer" }))
    await waitFor(() => expect(calls).toHaveBeenCalledWith("grant"))
  })

  it("quitarla es una acción de peligro con confirmación", async () => {
    api([marca])
    const { user: u } = renderWithQuery(
      <StreamerSection u={user({ streamer: true })} />
    )
    await u.click(screen.getByRole("button", { name: "Quitar streamer" }))
    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByText(/deja de andar en 30 segundos/)
    ).toBeInTheDocument()
    await u.click(
      within(dialog).getByRole("button", { name: "Quitar streamer" })
    )
    await waitFor(() => expect(calls).toHaveBeenCalledWith("revoke"))
  })
})
