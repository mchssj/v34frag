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
import { RegisterFlow } from "./RegisterFlow"

const navigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}))

const API = "http://api.test"
const server = setupServer(
  http.get(`${API}/api/v1/matches`, () =>
    HttpResponse.json({
      items: [],
      total: 1850,
      page: 1,
      per: 1,
      sort: "played_at",
      order: "desc",
    })
  ),
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

type User = ReturnType<typeof renderWithQuery>["user"]

async function stepOne(user: User, email = "juan.perez@gmail.com") {
  await user.type(screen.getByLabelText("Email"), email)
  await user.type(screen.getByLabelText("Contraseña"), "Larga-a1")
  await user.click(screen.getByRole("button", { name: "Continuar" }))
  await screen.findByText("Elige tu alias")
}

async function typeAlias(user: User, alias = "Mecha") {
  await user.type(screen.getByLabelText("Alias"), alias)
}

describe("RegisterFlow", () => {
  it("muestra los errores del paso 1 recién al intentar continuar", async () => {
    const { user } = renderWithQuery(<RegisterFlow />)
    expect(screen.getByText("Paso 1 de 3 · Cuenta")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Email"), "no-es-email")
    expect(
      screen.queryByText("Ingresa un email válido.")
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    expect(
      await screen.findByText("Ingresa un email válido.")
    ).toBeInTheDocument()
    expect(screen.getByText("Usa al menos 8 caracteres.")).toBeInTheDocument()
  })

  it("muestra la fuerza de la contraseña y el texto lateral con los mixes reales", async () => {
    const { user } = renderWithQuery(<RegisterFlow />)
    await user.type(screen.getByLabelText("Contraseña"), "Larga-a1")
    expect(screen.getByText("Fuerte")).toBeInTheDocument()
    expect(
      await screen.findByText("Más de 1.800 mixes reportados por el servidor.")
    ).toBeInTheDocument()
  })

  it("en el paso 2 marca el alias en uso y no crea la cuenta", async () => {
    const signup = vi.fn()
    server.use(
      http.get(`${API}/api/v1/aliases/:alias/available`, ({ params }) =>
        HttpResponse.json({
          alias: params.alias,
          available: false,
          reason: "taken",
        })
      ),
      http.post(`${API}/auth/signup`, () => {
        signup()
        return HttpResponse.json({}, { status: 500 })
      })
    )
    const { user } = renderWithQuery(<RegisterFlow />)
    await stepOne(user)
    await typeAlias(user)
    expect(await screen.findByText("En uso")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }))
    expect(signup).not.toHaveBeenCalled()
  })

  it("con confirmación de email termina en 'Revisa tu correo' con el email enmascarado", async () => {
    let body: unknown
    server.use(
      http.post(`${API}/auth/signup`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          { session: null, needsConfirmation: true },
          { status: 201 }
        )
      })
    )
    const { user } = renderWithQuery(<RegisterFlow />)
    await stepOne(user)
    await typeAlias(user)
    await screen.findByText("Disponible")
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }))
    expect(await screen.findByText("Revisa tu correo")).toBeInTheDocument()
    expect(screen.getByText("ju••••••@gmail.com")).toBeInTheDocument()
    expect(body).toEqual({
      email: "juan.perez@gmail.com",
      password: "Larga-a1",
      tag: "Mecha",
    })
    expect(tokenStore.getState().session).toBeNull()
  })

  it("si la API devuelve sesión, sigue directo a la Bienvenida", async () => {
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
                email: "x@y.co",
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
    const { user } = renderWithQuery(<RegisterFlow />)
    await stepOne(user)
    await typeAlias(user)
    await screen.findByText("Disponible")
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }))
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: "/welcome", replace: true })
    )
    expect(tokenStore.getState().session?.refreshToken).toBe("r1")
  })

  it("un email ya registrado vuelve al paso 1 con el error en el campo", async () => {
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
    const { user } = renderWithQuery(<RegisterFlow />)
    await stepOne(user)
    await typeAlias(user)
    await screen.findByText("Disponible")
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }))
    expect(
      await screen.findByText("Ya hay una cuenta con ese email.")
    ).toBeInTheDocument()
    expect(screen.getByText("Paso 1 de 3 · Cuenta")).toBeInTheDocument()
  })

  it("un 409 en el alias lo marca como 'En uso' sin salir del paso 2", async () => {
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
    const { user } = renderWithQuery(<RegisterFlow />)
    await stepOne(user)
    await typeAlias(user)
    await screen.findByText("Disponible")
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }))
    expect(await screen.findByText("En uso")).toBeInTheDocument()
    expect(screen.getByText("Paso 2 de 3 · Alias")).toBeInTheDocument()
  })
})
