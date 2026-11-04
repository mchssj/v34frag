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
import { ResetPasswordForm } from "./ResetPasswordForm"

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
const apiError = (code: string, status: number) =>
  HttpResponse.json(
    { error: { code, message: "x", requestId: "req-1" } },
    { status }
  )

const submit = () => screen.getByRole("button", { name: "Guardar y entrar" })
async function fill(
  user: ReturnType<typeof renderWithQuery>["user"],
  a = "nueva-clave-1",
  b = a
) {
  await user.type(screen.getByLabelText("Contraseña nueva"), a)
  await user.type(screen.getByLabelText("Repite la contraseña"), b)
}

describe("ResetPasswordForm", () => {
  it("sin token en el link pide otro correo, sin formulario", () => {
    renderWithQuery(<ResetPasswordForm tokenHash={null} />)
    expect(
      screen.getByText(/El enlace no es válido o venció/)
    ).toBeInTheDocument()
    expect(screen.getByText("Pedir otro correo")).toBeInTheDocument()
    expect(screen.queryByLabelText("Contraseña nueva")).not.toBeInTheDocument()
  })

  it("valida el largo y que las dos coincidan antes de llamar a la API", async () => {
    const { user } = renderWithQuery(<ResetPasswordForm tokenHash="h1" />)
    await fill(user, "corta", "otra")
    await user.click(submit())
    expect(
      await screen.findByText("Usa al menos 8 caracteres.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Las contraseñas no coinciden.")
    ).toBeInTheDocument()
  })

  it("manda el token y la contraseña, guarda la sesión y va a /home", async () => {
    let body: unknown
    server.use(
      http.post(`${API}/auth/password/reset`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(apiSession)
      })
    )
    const { user, queryClient } = renderWithQuery(
      <ResetPasswordForm tokenHash="h1" />
    )
    await fill(user)
    await user.click(submit())
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: "/home", replace: true })
    )
    expect(body).toEqual({ token_hash: "h1", new_password: "nueva-clave-1" })
    expect(tokenStore.getState().session).toMatchObject({ accessToken: "a1" })
    expect(queryClient.getQueryData(["auth", "me"])).toMatchObject({
      tag: "Mecha",
    })
  })

  it("con el link vencido o usado muestra el aviso y deja de mostrar el formulario", async () => {
    server.use(
      http.post(`${API}/auth/password/reset`, () =>
        apiError("INVALID_LINK", 400)
      )
    )
    const { user } = renderWithQuery(<ResetPasswordForm tokenHash="h1" />)
    await fill(user)
    await user.click(submit())
    expect(
      await screen.findByText(/El enlace no es válido o venció/)
    ).toBeInTheDocument()
    expect(screen.queryByLabelText("Contraseña nueva")).not.toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it("si la nueva es igual a la anterior explica que hay que pedir otro correo", async () => {
    server.use(
      http.post(`${API}/auth/password/reset`, () =>
        apiError("SAME_PASSWORD", 400)
      )
    )
    const { user } = renderWithQuery(<ResetPasswordForm tokenHash="h1" />)
    await fill(user)
    await user.click(submit())
    expect(
      await screen.findByText(/tiene que ser distinta de la anterior/)
    ).toBeInTheDocument()
    expect(screen.getByText("Pedir otro correo")).toBeInTheDocument()
  })

  it("con un error del servidor muestra el código y permite reintentar", async () => {
    let calls = 0
    server.use(
      http.post(`${API}/auth/password/reset`, () =>
        ++calls === 1
          ? apiError("INTERNAL", 500)
          : HttpResponse.json(apiSession)
      )
    )
    const { user } = renderWithQuery(<ResetPasswordForm tokenHash="h1" />)
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
