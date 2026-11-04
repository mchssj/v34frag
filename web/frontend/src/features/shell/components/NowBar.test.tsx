import { screen } from "@testing-library/react"
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

import { TooltipProvider } from "@/components/ui/tooltip"
import type { AuthUser } from "@/auth/queries"
import type { MatchSummary } from "@/features/matches/types"
import type { MixItem } from "@/features/mixes/types"
import { renderWithQuery } from "@/test/render"
import { useBadgeCounts } from "../api/queries"
import { NowBar } from "./NowBar"

const path = vi.hoisted(() => ({ current: "/home" }))
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  useRouterState: () => path.current,
  // Sin router en la prueba: el link arma la URL con sus params.
  Link: ({
    to,
    params,
    children,
  }: {
    to: string
    params?: Record<string, string>
    children: ReactNode
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (url, [k, v]) => url.replace(`$${k}`, v),
        to
      )}
    >
      {children}
    </a>
  ),
}))

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  path.current = "/home"
})
afterAll(() => server.close())

const mix: MixItem = {
  match_id: null,
  live_uid: "srv1-1",
  status: "live",
  map: "mirage_rc1",
  server: { id: "s1", name: "Server CM League #1" },
  started_at: "2026-11-04T19:08:54Z",
  ended_at: null,
  side1: { name: "Equipo Kai", score: 2 },
  side2: { name: "Equipo Nube", score: 3 },
  winner_side: null,
  rounds_played: 5,
  current_round: 6,
  max_rounds: 30,
  stale: false,
  mvp: null,
  demo_status: "none",
  review: null,
  cancel_reason: null,
  tv: { host: "190.104.34.3", port: 27065 },
}

const official: MatchSummary = {
  id: "m-1",
  kind: "official",
  status: "live",
  label: "Final",
  event: { id: "e1", name: "Copa TITAN" },
  side1: { name: "GO TO KNOW", team: null, score: 1 },
  side2: { name: "STRIX", team: null, score: 0 },
  winner_side: null,
  best_of: 3,
  map: "de_dust2",
  starts_at: "2026-11-04T19:00:00Z",
  played_at: null,
  end_reason: null,
  cancel_reason: null,
  review: null,
  demo_status: "none",
  parent_match_id: null,
}

function answer(matches: MatchSummary[], mixes: MixItem[]) {
  server.use(
    http.get(`${API}/api/v1/matches/:id`, () =>
      HttpResponse.json({ ...official, server: null })
    ),
    http.get(`${API}/api/v1/matches`, () =>
      HttpResponse.json({
        items: matches,
        total: matches.length,
        page: 1,
        per: 1,
        sort: "played_at",
        order: "desc",
      })
    ),
    http.get(`${API}/api/v1/mixes`, () =>
      HttpResponse.json({
        items: mixes,
        total: mixes.length,
        page: 1,
        per: 20,
        sort: "started_at",
        order: "desc",
      })
    ),
    http.get(`${API}/api/v1/pcw/posts`, () =>
      HttpResponse.json({ items: [], total: 0, page: 1, per: 1 })
    )
  )
}

const renderBar = () =>
  renderWithQuery(
    <TooltipProvider>
      <NowBar />
    </TooltipProvider>
  )

describe("NowBar", () => {
  it("sin partidas en vivo, muestra el mix con su sala y SourceTV", async () => {
    answer([], [mix])
    renderBar()
    expect(await screen.findByText("EN VIVO")).toBeInTheDocument()
    expect(screen.getByText("Equipo Kai 2 : 3 Equipo Nube")).toBeInTheDocument()
    expect(
      screen.getByText("Mix · mirage_rc1 · Ronda 6 de 30 · Server CM League #1")
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Ver sala/ })).toHaveAttribute(
      "href",
      "/mixes/live/srv1-1"
    )
    expect(screen.getByRole("link", { name: /Ver en TV/ })).toBeInTheDocument()
  })

  it("prefiere un mix con novedades a uno sin novedades del servidor", async () => {
    answer([], [{ ...mix, live_uid: "viejo", stale: true }, mix])
    renderBar()
    expect(
      await screen.findByRole("link", { name: /Ver sala/ })
    ).toHaveAttribute("href", "/mixes/live/srv1-1")
  })

  it("una partida oficial en vivo le gana al mix", async () => {
    answer([official], [mix])
    renderBar()
    expect(await screen.findByText("GO TO KNOW vs STRIX")).toBeInTheDocument()
    expect(screen.queryByText(/Equipo Kai/)).not.toBeInTheDocument()
  })

  it("se oculta dentro de la sala del mix", async () => {
    path.current = "/mixes/live/srv1-1"
    answer([], [mix])
    renderBar()
    // Da tiempo a que lleguen las consultas antes de comprobar que no hay nada.
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText("EN VIVO")).not.toBeInTheDocument()
  })
})

function Counts() {
  const c = useBadgeCounts({ role: "user" } as AuthUser)
  return <span data-testid="live">{String(c.live)}</span>
}

describe("useBadgeCounts", () => {
  it("el badge en vivo suma partidas y mixes", async () => {
    answer([official], [mix, { ...mix, live_uid: "srv3-1" }])
    renderWithQuery(<Counts />)
    expect(await screen.findByText("3")).toBeInTheDocument()
  })

  it("solo con mixes en vivo, el badge aparece igual", async () => {
    answer([], [mix])
    renderWithQuery(<Counts />)
    expect(await screen.findByText("1")).toBeInTheDocument()
  })
})
