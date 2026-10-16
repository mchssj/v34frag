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
import { SignupForm } from "./SignupForm"

const navigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}))

const API = "http://api.test"
const server = setupServer(
  // Por defecto el alias está libre.
  http.get(`${API}/api/v1/aliases/:alias/available`, ({ params }) =>
    HttpResponse.json({ alias: params.alias, available: true, reason: null })
  )
)
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  navigate.mockReset()
  tokenStore.logout()
})
afterAll(() => server.close())

async function fill(
  user: ReturnType<typeof renderWithQuery>["user"],
  alias = "Mecha"
) {
  await user.type(screen.getByLabelText("Email"), "a@b.co")
  await user.type(screen.getByLabelText("Contraseña"), "secreta")
  await user.type(screen.getByLabelText("Alias"), alias)
}

const submit = () => screen.getByRole("button", { name: "Crear cuenta" })

describe("SignupForm", () => {
  it("con confirmación de email va a 'Revisa tu correo' sin guardar sesión", async () => {
    server.use(
      http.post(`${API}/auth/signup`, () =>
        HttpResponse.json(
          { session: null, needsConfirmation: true },
          { status: 201 }
        )
      )
    )
    const { user } = renderWithQuery(<SignupForm />)
    await fill(user)
    await user.click(submit())
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/registro/confirmar",
        state: { signupEmail: "a@b.co" },
      })
    )
    expect(tokenStore.getState().session).toBeNull()
  })

  it("sin confirmación guarda la sesión y sigue a los pasos opcionales", async () => {
    server.use(
      http.post(`${API}/auth/signup`, () =>
        HttpResponse.json(
          {
            needsConfirmation: false,
            session: {
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
            },
          },
          { status: 201 }
        )
      )
    )
    const { user } = renderWithQuery(<SignupForm />)
    await fill(user)
    await user.click(submit())
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/completar-perfil",
        search: { paso: "datos" },
        replace: true,
      })
    )
    expect(tokenStore.getState().session?.refreshToken).toBe("r1")
  })

  it("muestra en vivo que el alias está tomado y no envía el formulario", async () => {
    const signup = vi.fn()
    server.use(
      http.get(`${API}/api/v1/aliases/:alias/available`, () =>
        HttpResponse.json({ alias: "Mecha", available: false, reason: "taken" })
      ),
      http.post(`${API}/auth/signup`, () => {
        signup()
        return HttpResponse.json({}, { status: 500 })
      })
    )
    const { user } = renderWithQuery(<SignupForm />)
    await fill(user)
    expect(
      await screen.findByText(
        "Ese alias ya está en uso.",
        {},
        { timeout: 2000 }
      )
    ).toBeInTheDocument()
    await user.click(submit())
    expect(
      await screen.findAllByText("Ese alias ya está en uso.")
    ).not.toHaveLength(0)
    expect(signup).not.toHaveBeenCalled()
  })

  it("marca el alias si la API responde 409 con details en tag", async () => {
    server.use(
      http.post(`${API}/auth/signup`, () =>
        HttpResponse.json(
          {
            error: {
              code: "CONFLICT",
              message: "Ese alias ya está en uso.",
              details: [{ path: "tag", message: "Ese alias ya está en uso." }],
              requestId: "r",
            },
          },
          { status: 409 }
        )
      )
    )
    const { user } = renderWithQuery(<SignupForm />)
    await fill(user)
    await user.click(submit())
    const alias = screen.getByLabelText("Alias")
    await waitFor(() => expect(alias).toHaveAttribute("aria-invalid", "true"))
    expect(screen.getByText("Ese alias ya está en uso.")).toBeInTheDocument()
  })

  it("un email ya registrado se muestra como error general", async () => {
    server.use(
      http.post(`${API}/auth/signup`, () =>
        HttpResponse.json(
          {
            error: {
              code: "CONFLICT",
              message: "Ya hay una cuenta con ese email.",
              requestId: "r",
            },
          },
          { status: 409 }
        )
      )
    )
    const { user } = renderWithQuery(<SignupForm />)
    await fill(user)
    await user.click(submit())
    expect(
      await screen.findByText("Ya hay una cuenta con ese email.")
    ).toBeInTheDocument()
  })

  it("si la verificación del alias falla, no bloquea el registro", async () => {
    server.use(
      http.get(`${API}/api/v1/aliases/:alias/available`, () =>
        HttpResponse.json(
          { error: { code: "INTERNAL", message: "x", requestId: "r" } },
          { status: 500 }
        )
      ),
      http.post(`${API}/auth/signup`, () =>
        HttpResponse.json(
          { session: null, needsConfirmation: true },
          { status: 201 }
        )
      )
    )
    const { user } = renderWithQuery(<SignupForm />)
    await fill(user)
    await user.click(submit())
    await waitFor(() => expect(navigate).toHaveBeenCalled())
  })

  it("valida el alias en el navegador", async () => {
    const { user } = renderWithQuery(<SignupForm />)
    await fill(user, "a<b")
    await user.click(submit())
    expect(
      await screen.findByText("El alias no puede tener < ni >.")
    ).toBeInTheDocument()
  })
})
