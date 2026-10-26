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
import { sampleNotifications } from "./mock"
import { NotificationsMenu } from "./NotificationsMenu"

const navigate = vi.hoisted(() => vi.fn())
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
  useRouter: () => ({ subscribe: () => () => {} }),
}))

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

const read = vi.fn()
const accepted = vi.fn()

function api() {
  server.use(
    http.get(`${API}/auth/me`, () =>
      HttpResponse.json({
        id: "u1",
        email: null,
        tag: "Zeta",
        role: "user",
        created_at: null,
        password_changed_at: null,
      })
    ),
    http.get(`${API}/api/v1/notifications/unread-count`, () =>
      HttpResponse.json(
        { unread: 2, actionable: 1 },
        { headers: { ETag: '"c1"' } }
      )
    ),
    http.get(`${API}/api/v1/notifications`, () =>
      HttpResponse.json({
        // Como la base: aceptar la invitación resuelve su notificación.
        items: sampleNotifications().map((n) =>
          n.id === 1 && accepted.mock.calls.length
            ? { ...n, resolution: "accepted", read: true }
            : n
        ),
        total: 4,
        page: 1,
        per: 100,
        sort: "created_at",
        order: "desc",
      })
    ),
    http.post(`${API}/api/v1/notifications/read`, async ({ request }) => {
      read(await request.json())
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API}/api/v1/team-invites/i1/accept`, () => {
      accepted()
      return new HttpResponse(null, { status: 204 })
    }),
    http.get(`${API}/api/v1/me/profile`, () => HttpResponse.json({}))
  )
}

describe("campana de notificaciones", () => {
  it("el número sale del contador y la lista se pide al abrir", async () => {
    api()
    const { user } = renderWithQuery(<NotificationsMenu />)
    const bell = await screen.findByRole("button", {
      name: "Notificaciones, 2 sin leer",
    })
    await user.click(bell)
    expect(
      await screen.findByText("Invitación a Furia Sur")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Kova te invitó a unirte al plantel.")
    ).toBeInTheDocument()
    expect(screen.getByText("Te toca vetar")).toBeInTheDocument()
    expect(
      screen.getByText("Nueva medalla: 🏅 BETA · Top 10")
    ).toBeInTheDocument()
    // Un pedido ya resuelto muestra cómo quedó, sin botones.
    const done = screen
      .getByText("Mati quiere entrar a Furia Sur")
      .closest("li")!
    expect(within(done).getByText("Aceptado")).toBeInTheDocument()
    expect(within(done).queryByRole("button", { name: "Aceptar" })).toBeNull()
  })

  it("aceptar una invitación usa su endpoint y la marca leída", async () => {
    api()
    const { user } = renderWithQuery(<NotificationsMenu />)
    await user.click(
      await screen.findByRole("button", { name: /Notificaciones/ })
    )
    const row = (await screen.findByText("Invitación a Furia Sur")).closest(
      "li"
    )!
    await user.click(within(row).getByRole("button", { name: "Aceptar" }))
    await waitFor(() => expect(accepted).toHaveBeenCalled())
    await waitFor(() => expect(read).toHaveBeenCalledWith({ ids: [1] }))
    expect(await within(row).findByText("Aceptada")).toBeInTheDocument()
  })

  it("abrir una notificación con link navega y la marca leída; marcar todo", async () => {
    api()
    const { user } = renderWithQuery(<NotificationsMenu />)
    await user.click(
      await screen.findByRole("button", { name: /Notificaciones/ })
    )
    await user.click(await screen.findByText("Te toca vetar"))
    expect(read).toHaveBeenCalledWith({ ids: [2] })
    expect(navigate).toHaveBeenCalledWith({
      to: "/match/$id",
      params: { id: "m1" },
    })

    await user.click(screen.getByRole("button", { name: /Notificaciones/ }))
    await user.click(
      await screen.findByRole("button", { name: "Marcar todo como leído" })
    )
    await waitFor(() => expect(read).toHaveBeenLastCalledWith({ all: true }))
  })
})
