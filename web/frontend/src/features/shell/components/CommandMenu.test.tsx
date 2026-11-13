import { screen, within } from "@testing-library/react"
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

import type { AuthUser } from "@/auth/queries"
import { renderWithQuery } from "@/test/render"
import { CommandMenu } from "./CommandMenu"

const navigate = vi.hoisted(() => vi.fn())
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
}))

const API = "http://api.test"
const server = setupServer()
const asked: string[] = []
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  navigate.mockReset()
  asked.length = 0
})
afterAll(() => server.close())

const page = <T,>(items: T[]) => ({
  items,
  total: items.length,
  page: 1,
  per: 5,
})

function answer() {
  server.use(
    http.get(`${API}/api/v1/players`, ({ request }) => {
      asked.push(new URL(request.url).searchParams.get("q") ?? "")
      return HttpResponse.json(
        page([
          {
            id: "11111111-1111-4111-8111-111111111111",
            alias: "Grimmy",
            has_account: true,
            has_steam: true,
            photo_url: null,
            elo: 1200,
            level: 6,
            elo_matches: 10,
            maps: 10,
            rating: 1,
            kd: 1,
            wins: 5,
            losses: 5,
            teams: [{ id: "t1", name: "Grim Team", tag: "GRM" }],
            vip: false,
            verified: null,
          },
        ])
      )
    }),
    http.get(`${API}/api/v1/teams`, () =>
      HttpResponse.json(
        page([
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Grim Team",
            tag: "GRM",
            kind: "official",
            captain: null,
            members: 5,
            max_members: 10,
            plays_as: null,
            logo_url: null,
            looking_for: [],
          },
        ])
      )
    ),
    // Si uno falla, los otros grupos se muestran igual.
    http.get(`${API}/api/v1/events`, () =>
      HttpResponse.json({ error: { code: "INTERNAL" } }, { status: 500 })
    )
  )
}

const user = { role: "user" } as AuthUser

describe("CommandMenu", () => {
  it("busca jugadores y equipos en la API y abre el elegido", async () => {
    answer()
    const { user: u } = renderWithQuery(
      <CommandMenu user={user} open onOpenChange={() => {}} />
    )
    await u.type(screen.getByRole("combobox"), "grim")

    const players = await screen.findByRole("group", { name: "Jugadores" })
    expect(within(players).getByText("Grimmy")).toBeInTheDocument()
    expect(within(players).getByText("GRM")).toBeInTheDocument()
    const teams = screen.getByRole("group", { name: "Equipos" })
    expect(within(teams).getByText("Grim Team")).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Torneos" })).toBeNull()
    // Espera a que se escriba todo: no pide por cada letra.
    expect(asked).toEqual(["grim"])

    await u.click(within(players).getByText("Grimmy"))
    expect(navigate).toHaveBeenCalledWith({
      to: "/player/$nick",
      params: { nick: "Grimmy" },
    })
  })

  it("con una letra solo filtra páginas, sin pedir a la API", async () => {
    const { user: u } = renderWithQuery(
      <CommandMenu user={user} open onOpenChange={() => {}} />
    )
    await u.type(screen.getByRole("combobox"), "r")
    await new Promise((r) => setTimeout(r, 400))
    expect(screen.getByRole("group", { name: "Páginas" })).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Jugadores" })).toBeNull()
  })

  it("filtra las páginas y ordena por coincidencia", async () => {
    server.use(
      http.get(`${API}/api/v1/:list`, () => HttpResponse.json(page([])))
    )
    const { user: u } = renderWithQuery(
      <CommandMenu user={user} open onOpenChange={() => {}} />
    )
    await u.type(screen.getByRole("combobox"), "cerrar")
    // "cerrar" empieza una palabra de Cerrar sesión: va primero y Enter lo elige.
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Cerrar sesión")
    expect(screen.queryByText("Partidas")).toBeNull()
  })
})
