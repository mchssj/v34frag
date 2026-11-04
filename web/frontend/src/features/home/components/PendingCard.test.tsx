import { screen, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import type { AnchorHTMLAttributes, ReactNode } from "react"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import type { MmState } from "@/features/matchmaking/types"
import { renderWithQuery } from "@/test/render"
import { PendingCard } from "./PendingCard"

// Los botones de los avisos son links: sin router, alcanza con un <a>.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    params,
    ...rest
  }: { to: string; params?: unknown; children: ReactNode } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "href"
  >) => {
    void params
    return (
      <a href={to} {...rest}>
        {children}
      </a>
    )
  },
}))

// El estado del matchmaking se simula: la tarjeta solo lo lee y llama a la fuente.
const mm = vi.hoisted(() => ({
  state: undefined as unknown,
  source: {
    accept: vi.fn(),
    respondInvite: vi.fn(),
  },
}))
vi.mock("../lib/useMmState", () => ({
  useMmState: () => ({ source: mm.source, state: mm.state }),
}))

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

const notif = (o: Record<string, unknown>) => ({
  id: 1,
  type: "medal_granted",
  category: "account",
  data: {},
  actionable: false,
  resolution: null,
  actor: null,
  created_at: "2026-11-03T10:00:00Z",
  read: false,
  ...o,
})

function api(items: unknown[]) {
  server.use(
    http.get(`${API}/api/v1/notifications`, () =>
      HttpResponse.json({ items, total: items.length, page: 1, per: 100 })
    ),
    http.get(`${API}/api/v1/me/profile`, () =>
      HttpResponse.json({ player: { id: "p1", nick: "juanma" }, teams: [] })
    )
  )
}

const lobbyAccepting = {
  status: "accepting",
  accept_deadline: new Date(Date.now() + 40_000).toISOString(),
  players: [{ is_me: true, accepted: false }],
}

describe("Pendientes", () => {
  it("ordena por urgencia: la sala por aceptar, el veto, el grupo, el equipo y los avisos", async () => {
    mm.state = {
      lobby: lobbyAccepting,
      invites: [{ id: "i1", from: { nick: "kyan" }, expires_at: "" }],
    } as unknown as MmState
    api([
      notif({ id: 1, type: "medal_granted", data: { title: "Top 10" } }),
      notif({
        id: 2,
        type: "team_invite",
        actionable: true,
        data: { team: { name: "GO TO KNOW" }, invite_id: "t1" },
      }),
      notif({ id: 3, type: "veto_turn", data: { match_id: "m1" } }),
      notif({ id: 4, type: "level_changed", read: true }),
    ])
    renderWithQuery(<PendingCard />)

    const card = await screen.findByRole("region", { name: "Pendientes" })
    const rows = await within(card).findAllByRole("listitem")
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Te encontramos partida"),
      expect.stringContaining("Te toca vetar"),
      expect.stringContaining("kyan te invitó a su grupo"),
      expect.stringContaining("Invitación a GO TO KNOW"),
      expect.stringContaining("Nueva medalla"),
    ])
    expect(within(card).getByText("5 pendientes")).toBeInTheDocument()
    expect(
      within(rows[1]).getByRole("link", { name: "Ir al veto" })
    ).toBeInTheDocument()
    expect(
      within(rows[3]).getByRole("button", { name: "Aceptar" })
    ).toBeInTheDocument()
  })

  it("Aceptar llama al matchmaking", async () => {
    mm.state = { lobby: lobbyAccepting, invites: [] } as unknown as MmState
    mm.source.accept.mockResolvedValue({ lobby: null, invites: [] })
    api([])
    const { user } = renderWithQuery(<PendingCard />)
    await user.click(await screen.findByRole("button", { name: "Aceptar" }))
    expect(mm.source.accept).toHaveBeenCalled()
  })

  it("sin nada pendiente: Todo al día", async () => {
    mm.state = { lobby: null, invites: [] } as unknown as MmState
    api([notif({ read: true })])
    renderWithQuery(<PendingCard />)
    expect(await screen.findByText("Todo al día")).toBeInTheDocument()
  })
})
