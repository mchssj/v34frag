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

import { authKeys } from "@/auth/queries"
import { renderWithQuery } from "@/test/render"
import { NotificationPrefsCard } from "./NotificationPrefsCard"

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

const prefs = {
  team: true,
  tournament: true,
  pcw: true,
  elo: true,
  season: true,
  account: true,
  news: false,
  admin: true,
}
const patched = vi.fn()

function api(fail = false) {
  server.use(
    http.get(`${API}/api/v1/me/profile`, () =>
      HttpResponse.json({
        preferences: { theme_fx: null, notifications: prefs },
      })
    ),
    http.patch(`${API}/api/v1/me/profile`, async ({ request }) => {
      patched(await request.json())
      return fail
        ? HttpResponse.json(
            { error: { code: "INTERNAL", message: "x", requestId: "r" } },
            { status: 500 }
          )
        : HttpResponse.json({
            preferences: {
              theme_fx: null,
              notifications: { ...prefs, news: true },
            },
          })
    })
  )
}

// Sin sesión en las pruebas: el usuario va directo a la caché de Query.
async function renderCard(role: "user" | "admin") {
  const r = renderWithQuery(<NotificationPrefsCard />)
  // La consulta que arranca al montar devolvería null y pisaría al usuario.
  await r.queryClient.cancelQueries({ queryKey: authKeys.me })
  r.queryClient.setQueryData(authKeys.me, {
    id: "u1",
    email: null,
    tag: "Zeta",
    role,
    created_at: null,
    password_changed_at: null,
  })
  return r
}

describe("preferencias de notificaciones", () => {
  it("muestra lo guardado, aclara las obligatorias y oculta Administración a un usuario", async () => {
    api()
    await renderCard("user")
    expect(await screen.findByRole("switch", { name: /Equipos/ })).toBeChecked()
    expect(screen.getByRole("switch", { name: /Novedades/ })).not.toBeChecked()
    expect(
      screen.getByText(
        "Las invitaciones y los pedidos para entrar llegan siempre."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText("El aviso de cambio de contraseña llega siempre.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("switch", { name: /Administración/ })).toBeNull()
  })

  it("un admin ve Administración; tocar una categoría manda solo esa", async () => {
    api()
    const { user } = await renderCard("admin")
    expect(
      await screen.findByRole("switch", { name: /Administración/ })
    ).toBeChecked()
    await user.click(screen.getByRole("switch", { name: /Novedades/ }))
    await waitFor(() =>
      expect(patched).toHaveBeenCalledWith({
        preferences: { notifications: { news: true } },
      })
    )
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /Novedades/ })).toBeChecked()
    )
  })

  it("si la API falla vuelve atrás", async () => {
    api(true)
    const { user } = await renderCard("user")
    await user.click(await screen.findByRole("switch", { name: /Novedades/ }))
    await waitFor(() => expect(patched).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: /Novedades/ })
      ).not.toBeChecked()
    )
  })
})
