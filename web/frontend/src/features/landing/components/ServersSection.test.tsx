import { screen, within } from "@testing-library/react"
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
import { ServersSection } from "./ServersSection"

// Los links solo necesitan su destino en esta prueba.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
  }: {
    children: ReactNode
    to: string
    search?: Record<string, string>
  }) => (
    <a href={search?.redirect ? `${to}?redirect=${search.redirect}` : to}>
      {children}
    </a>
  ),
}))

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const srv = (o: Record<string, unknown>) => ({
  id: crypto.randomUUID(),
  name: "CM League #1",
  address: "1.2.3.4:27015",
  tv_address: null,
  mode: "competitive",
  region: null,
  online: true,
  ping_ms: 20,
  map: "de_mirage_rc1",
  players: 10,
  max_players: 12,
  bots: 0,
  live_matches: 1,
  ...o,
})

function api(discord: { online: number | null; members: number | null }) {
  server.use(
    http.get(`${API}/api/v1/servers/status`, () =>
      HttpResponse.json({
        servers: [
          srv({}),
          srv({
            name: "CM League #3",
            online: false,
            map: null,
            players: null,
            max_players: null,
            live_matches: 0,
          }),
        ],
        totals: {
          servers: 2,
          online: 1,
          players: 10,
          live_matches: 1,
          in_queue: 7,
        },
        mm_open: true,
        checked_at: "2026-11-07T12:00:00Z",
      })
    ),
    http.get(`${API}/api/v1/community/discord`, () =>
      HttpResponse.json({
        ...discord,
        invite_url: "https://discord.gg/bn5Yxsh9tc",
      })
    )
  )
}

describe("sección Juega del inicio (replanteo 83)", () => {
  it("la cola, los servidores con su nombre público y el Discord con números reales", async () => {
    api({ online: 180, members: 1500 })
    renderWithQuery(<ServersSection />)

    expect(
      screen.getByRole("heading", { name: "Tu próxima partida, a un clic." })
    ).toBeInTheDocument()
    expect(await screen.findByText("Cola abierta")).toBeInTheDocument()
    expect(screen.getByText("en la cola").parentElement).toHaveTextContent("7")

    const list = screen.getByRole("list", { name: "Servidores" })
    expect(within(list).getByText("CM League #1")).toBeInTheDocument()
    expect(within(list).getByText("Partida en vivo")).toBeInTheDocument()
    expect(within(list).getByText("Fuera de línea")).toBeInTheDocument()
    // Sin el botón Conectar: la partida se busca desde la web.
    expect(screen.queryByText("Conectar")).not.toBeInTheDocument()

    expect(
      screen.getByRole("link", { name: /Buscar partida/ })
    ).toHaveAttribute("href", "/register")
    expect(
      screen.getByRole("link", { name: "Ya tengo cuenta" })
    ).toHaveAttribute("href", "/login?redirect=/play")
    expect(await screen.findByText("1.500")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Unirse al servidor/ })
    ).toHaveAttribute("href", "https://discord.gg/bn5Yxsh9tc")
  })

  it("si Discord no da números, la tarjeta sale sin ellos (nada inventado)", async () => {
    api({ online: null, members: null })
    renderWithQuery(<ServersSection />)
    expect(await screen.findByText("Cola abierta")).toBeInTheDocument()
    expect(screen.queryByText("miembros")).not.toBeInTheDocument()
    expect(screen.getByText("Únete al Discord")).toBeInTheDocument()
  })
})
