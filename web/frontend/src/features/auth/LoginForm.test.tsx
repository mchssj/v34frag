import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import type { ReactNode } from "react"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { tokenStore } from "@/auth/tokenStore"
import { renderWithQuery } from "@/test/render"
import { LoginForm } from "./LoginForm"

const navigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}))

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  navigate.mockReset()
  tokenStore.logout()
})
afterAll(() => server.close())

const apiSession = {
  access_token: "a1",
  refresh_token: "r1",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: "u1",
    email: "a@b.co",
    tag: "Mecha",
    role: "user",
    created_at: null,
  },
}

async function fill(user: ReturnType<typeof renderWithQuery>["user"]) {
  await user.type(screen.getByLabelText("Email"), "a@b.co")
  await user.type(screen.getByLabelText("Contraseña"), "secreta")
}

describe("LoginForm", () => {
  it("valida en el navegador antes de llamar a la API", async () => {
    const { user } = renderWithQuery(<LoginForm redirectTo="/panel" />)
    await user.click(screen.getByRole("button", { name: "Ingresar" }))
    expect(await screen.findByText("Escribe tu email.")).toBeInTheDocument()
    expect(screen.getByText("Escribe tu contraseña.")).toBeInTheDocument()
  })

  it("muestra el error de credenciales según el code", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          {
            error: {
              code: "INVALID_CREDENTIALS",
              message: "x",
              requestId: "r",
            },
          },
          { status: 401 }
        )
      )
    )
    const { user } = renderWithQuery(<LoginForm redirectTo="/panel" />)
    await fill(user)
    await user.click(screen.getByRole("button", { name: "Ingresar" }))
    expect(
      await screen.findByText("Email o contraseña incorrectos.")
    ).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    expect(tokenStore.getState().session).toBeNull()
  })

  it("con credenciales correctas guarda la sesión y navega a la ruta de vuelta", async () => {
    let body: unknown
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(apiSession)
      })
    )
    const { user, queryClient } = renderWithQuery(
      <LoginForm redirectTo="/panel" />
    )
    await fill(user)
    await user.click(screen.getByRole("button", { name: "Ingresar" }))
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ href: "/panel", replace: true })
    )
    expect(body).toEqual({ email: "a@b.co", password: "secreta" })
    expect(tokenStore.getState().session).toMatchObject({
      accessToken: "a1",
      refreshToken: "r1",
    })
    expect(tokenStore.getState().remember).toBe(true)
    expect(queryClient.getQueryData(["auth", "me"])).toMatchObject({
      tag: "Mecha",
    })
  })

  it("sin Recordarme la sesión va a sessionStorage", async () => {
    server.use(
      http.post(`${API}/auth/login`, () => HttpResponse.json(apiSession))
    )
    const { user } = renderWithQuery(<LoginForm redirectTo="/" />)
    await fill(user)
    await user.click(screen.getByLabelText("Recordarme en este equipo"))
    await user.click(screen.getByRole("button", { name: "Ingresar" }))
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(tokenStore.getState().remember).toBe(false)
    expect(window.sessionStorage.getItem("csstv.session")).not.toBeNull()
    expect(window.localStorage.getItem("csstv.session")).toBeNull()
  })

  it("con demasiados intentos bloquea el botón y muestra la cuenta regresiva", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { error: { code: "RATE_LIMITED", message: "x", requestId: null } },
          { status: 429, headers: { "Retry-After": "30" } }
        )
      )
    )
    const { user } = renderWithQuery(<LoginForm redirectTo="/" />)
    await fill(user)
    await user.click(screen.getByRole("button", { name: "Ingresar" }))
    expect(
      await screen.findByText(/Podrás volver a probar en 3\d s/)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeDisabled()
  })
})
