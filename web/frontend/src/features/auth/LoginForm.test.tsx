import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import type { ReactNode } from "react"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { tokenStore } from "@/auth/tokenStore"
import { renderWithQuery } from "@/test/render"
import { LoginForm } from "./LoginForm"

const navigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}))
const { needsWelcome } = vi.hoisted(() => ({ needsWelcome: vi.fn() }))
vi.mock("@/features/onboarding/queries", () => ({ needsWelcome }))

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  navigate.mockReset()
  needsWelcome.mockReset()
  tokenStore.logout()
})
afterAll(() => server.close())

const apiSession = {
  access_token: "a1",
  refresh_token: "r1",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "u1", email: "a@b.co", tag: "Mecha", role: "user", created_at: null },
}

const apiError = (code: string, status: number, headers = {}) =>
  HttpResponse.json(
    { error: { code, message: "x", requestId: "req-1" } },
    { status, headers }
  )

async function fill(user: ReturnType<typeof renderWithQuery>["user"]) {
  await user.type(screen.getByLabelText("Email"), "a@b.co")
  await user.type(screen.getByLabelText("Contraseña"), "secreta")
}

const submit = () => screen.getByRole("button", { name: "Iniciar sesión" })

describe("LoginForm", () => {
  it("valida en el navegador antes de llamar a la API", async () => {
    const { user } = renderWithQuery(<LoginForm redirectTo="/home" />)
    await user.click(submit())
    expect(await screen.findByText("Escribe tu email.")).toBeInTheDocument()
    expect(screen.getByText("Escribe tu contraseña.")).toBeInTheDocument()
  })

  it("muestra el error de credenciales y lo limpia al escribir", async () => {
    server.use(http.post(`${API}/auth/login`, () => apiError("INVALID_CREDENTIALS", 401)))
    const { user } = renderWithQuery(<LoginForm redirectTo="/home" />)
    await fill(user)
    await user.click(submit())
    expect(await screen.findByText("Email o contraseña incorrectos.")).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText("Contraseña"), "x")
    expect(screen.queryByText("Email o contraseña incorrectos.")).not.toBeInTheDocument()
  })

  it("con email sin confirmar muestra el mensaje del diseño", async () => {
    server.use(http.post(`${API}/auth/login`, () => apiError("EMAIL_NOT_CONFIRMED", 403)))
    const { user } = renderWithQuery(<LoginForm redirectTo="/home" />)
    await fill(user)
    await user.click(submit())
    expect(
      await screen.findByText("Confirma tu email. Te enviamos un link al registrarte.")
    ).toBeInTheDocument()
  })

  it("con credenciales correctas guarda la sesión y va a la ruta de vuelta", async () => {
    needsWelcome.mockResolvedValue(false)
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.json(apiSession)))
    const { user, queryClient } = renderWithQuery(<LoginForm redirectTo="/home" />)
    await fill(user)
    await user.click(submit())
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ href: "/home", replace: true })
    )
    expect(tokenStore.getState().session).toMatchObject({ accessToken: "a1" })
    expect(queryClient.getQueryData(["auth", "me"])).toMatchObject({ tag: "Mecha" })
  })

  it("en el primer ingreso va a la Bienvenida", async () => {
    needsWelcome.mockResolvedValue(true)
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.json(apiSession)))
    const { user } = renderWithQuery(<LoginForm redirectTo="/home" />)
    await fill(user)
    await user.click(submit())
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: "/welcome", replace: true })
    )
    expect(needsWelcome).toHaveBeenCalledWith(expect.anything(), "u1")
  })

  it("sin Recordarme la sesión va a sessionStorage", async () => {
    needsWelcome.mockResolvedValue(false)
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.json(apiSession)))
    const { user } = renderWithQuery(<LoginForm redirectTo="/" />)
    await fill(user)
    await user.click(screen.getByLabelText("Recordarme en este equipo"))
    await user.click(submit())
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(window.sessionStorage.getItem("csstv.session")).not.toBeNull()
    expect(window.localStorage.getItem("csstv.session")).toBeNull()
  })

  it("con demasiados intentos bloquea el botón y muestra los segundos", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        apiError("RATE_LIMITED", 429, { "Retry-After": "30" })
      )
    )
    const { user } = renderWithQuery(<LoginForm redirectTo="/" />)
    await fill(user)
    await user.click(submit())
    expect(
      await screen.findByText(/Demasiados intentos\. Espera (30|29) segundos y vuelve a probar\./)
    ).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it("con un error del servidor muestra el código y permite reintentar", async () => {
    needsWelcome.mockResolvedValue(false)
    let calls = 0
    server.use(
      http.post(`${API}/auth/login`, () =>
        ++calls === 1 ? apiError("INTERNAL", 500) : HttpResponse.json(apiSession)
      )
    )
    const { user } = renderWithQuery(<LoginForm redirectTo="/home" />)
    await fill(user)
    await user.click(submit())
    expect(
      await screen.findByText("Algo salió mal. Código de seguimiento: req-1")
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Reintentar" }))
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(calls).toBe(2)
  })
})
