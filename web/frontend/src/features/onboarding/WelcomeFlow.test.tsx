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

import type { AuthUser } from "@/auth/queries"
import { renderWithQuery } from "@/test/render"
import { WelcomeFlow } from "./WelcomeFlow"

const navigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}))

const API = "http://api.test"
const user = {
  id: "u1",
  email: "x@y.co",
  tag: "Mecha",
  role: "user",
  created_at: null,
} as AuthUser

type Details = Partial<Record<"real_name" | "game_role" | "discord", string>>

const profileWith = (details: Details) => ({
  user,
  details: {
    avatar_url: null,
    real_name: null,
    country: null,
    game_role: null,
    discord: null,
    steam: null,
    faceit: null,
    ...details,
  },
  player: null,
  teams: [],
  matches_played: 0,
})
const steamWith = (ids: string[]) => ({
  steam_ids: ids.map((steam_id, i) => ({ steam_id, is_primary: i === 0 })),
  max_steam_ids: 4,
  last_code: null,
  pending_requests: 0,
})

const patched = vi.fn()
const server = setupServer(
  http.patch(`${API}/api/v1/me/profile`, async ({ request }) => {
    const body = (await request.json()) as Details
    patched(body)
    return HttpResponse.json(profileWith(body))
  }),
  http.post(`${API}/api/v1/me/claim-code`, () =>
    HttpResponse.json({
      code: "ABC123",
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    })
  )
)
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  navigate.mockReset()
  patched.mockReset()
  localStorage.clear()
})
afterAll(() => server.close())

function given(details: Details, steamIds: string[]) {
  server.use(
    http.get(`${API}/api/v1/me/profile`, () =>
      HttpResponse.json(profileWith(details))
    ),
    http.get(`${API}/api/v1/me/claim-code`, () =>
      HttpResponse.json(steamWith(steamIds))
    )
  )
}

const label = (text: string) =>
  screen.findByText(`Completa tu perfil · ${text}`)

describe("WelcomeFlow", () => {
  it("solo falta el estilo: un paso y 'Guardar y terminar'", async () => {
    given({ real_name: "Martín", discord: "zeta" }, ["76561198000000000"])
    const { user: u } = renderWithQuery(<WelcomeFlow user={user} />)
    expect(await label("paso 1 de 1 · Estilo de juego")).toBeInTheDocument()
    await u.click(screen.getByRole("button", { name: "Guardar y terminar" }))
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: "/home", replace: true })
    )
    expect(patched).toHaveBeenCalledWith({
      game_role: "Rifler",
      country: "Argentina",
    })
  })

  it("sin nada cargado arranca en Foto; guardar vacío avanza sin pedir nada", async () => {
    given({}, [])
    const { user: u } = renderWithQuery(<WelcomeFlow user={user} />)
    expect(await label("paso 1 de 4 · Foto y nombre")).toBeInTheDocument()
    expect(
      screen.getByText("Nuevo jugador · empieza con 1000 ELO")
    ).toBeInTheDocument()
    await u.click(screen.getByRole("button", { name: "Guardar y seguir" }))
    expect(await label("paso 2 de 4 · Estilo de juego")).toBeInTheDocument()
    expect(patched).not.toHaveBeenCalled()
  })

  it("Contactos normaliza Discord y sigue a la vinculación", async () => {
    given({ real_name: "Martín", game_role: "IGL" }, [])
    const { user: u } = renderWithQuery(<WelcomeFlow user={user} />)
    expect(await label("paso 1 de 2 · Contactos")).toBeInTheDocument()
    await u.type(screen.getByLabelText("Discord"), "Zeta.CS#1234")
    await u.click(screen.getByRole("button", { name: "Guardar y seguir" }))
    expect(await label("paso 2 de 2 · Vinculación")).toBeInTheDocument()
    expect(patched).toHaveBeenCalledWith({ discord: "zeta.cs" })
  })
})
