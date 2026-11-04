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

import { renderWithQuery } from "@/test/render"
import { ForgotPasswordForm } from "./ForgotPasswordForm"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}))

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const submit = () => screen.getByRole("button", { name: "Enviar enlace" })

describe("ForgotPasswordForm", () => {
  it("valida el email antes de llamar a la API", async () => {
    const { user } = renderWithQuery(<ForgotPasswordForm />)
    await user.click(submit())
    expect(await screen.findByText("Escribe tu email.")).toBeInTheDocument()
  })

  it("pide el correo y muestra el mismo mensaje haya o no cuenta", async () => {
    const bodies: unknown[] = []
    server.use(
      http.post(`${API}/auth/password/forgot`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ ok: true }, { status: 202 })
      })
    )
    const { user } = renderWithQuery(<ForgotPasswordForm />)
    await user.type(screen.getByLabelText("Email"), "  a@b.co ")
    await user.click(submit())
    expect(await screen.findByText("Revisa tu correo")).toBeInTheDocument()
    expect(
      screen.getByText(/Si hay una cuenta con ese email/)
    ).toBeInTheDocument()
    expect(bodies).toEqual([{ email: "a@b.co" }])

    await user.click(
      screen.getByRole("button", { name: "No me llegó, probar de nuevo" })
    )
    expect(submit()).toBeInTheDocument()
  })

  it("con demasiados pedidos bloquea el botón y muestra los segundos", async () => {
    server.use(
      http.post(`${API}/auth/password/forgot`, () =>
        HttpResponse.json(
          { error: { code: "RATE_LIMITED", message: "x" } },
          { status: 429, headers: { "Retry-After": "60" } }
        )
      )
    )
    const { user } = renderWithQuery(<ForgotPasswordForm />)
    await user.type(screen.getByLabelText("Email"), "a@b.co")
    await user.click(submit())
    expect(
      await screen.findByText(/Demasiados intentos\. Espera (60|59) segundos/)
    ).toBeInTheDocument()
    await waitFor(() => expect(submit()).toBeDisabled())
  })

  it("muestra el aviso que le pasa la página", () => {
    renderWithQuery(
      <ForgotPasswordForm notice={<p>Ese enlace ya no sirve.</p>} />
    )
    expect(screen.getByText("Ese enlace ya no sirve.")).toBeInTheDocument()
  })
})
