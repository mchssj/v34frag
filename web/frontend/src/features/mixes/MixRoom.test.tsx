import { screen, waitFor, within } from "@testing-library/react"
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

import { TooltipProvider } from "@/components/ui/tooltip"
import { renderWithQuery } from "@/test/render"
import { DeleteMixDialog } from "./DeleteMixDialog"
import { MixLiveRoom, MixMatchRoom } from "./MixRoomPages"
import { fetchLiveMix } from "./queries"

const navigate = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
)
vi.mock("sonner", () => ({ toast }))
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
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

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

const line = (o: Record<string, unknown>) => ({
  player_id: "p",
  alias: "x",
  game_nick: "x",
  steam_id: null,
  side: 1,
  kills: 20,
  deaths: 10,
  assists: 3,
  headshots: 10,
  damage: 2600,
  rounds: 26,
  rating: 1.2,
  elo_delta: 24,
  ...o,
})

const zeta = line({ player_id: "me", alias: "Zeta", rating: 1.6 })
const players = [
  zeta,
  line({
    player_id: null,
    alias: null,
    game_nick: "invitado",
    rating: 0.7,
    steam_id: "765",
  }),
  line({
    player_id: "p3",
    alias: "Vasco",
    side: 2,
    elo_delta: -24,
    kills: 9,
    deaths: 18,
  }),
]

const detail = (o: Record<string, unknown> = {}) => ({
  id: "m-1",
  kind: "mix",
  status: "finished",
  label: null,
  event: null,
  side1: { name: "Bando Zeta", team: null, score: 16 },
  side2: { name: "Bando Vasco", team: null, score: 12 },
  winner_side: 1,
  best_of: 1,
  map: "de_tuscan",
  starts_at: null,
  played_at: "2026-10-24T23:00:00Z",
  end_reason: null,
  cancel_reason: null,
  review: null,
  demo_status: "uploaded",
  parent_match_id: null,
  server: { id: "s1", name: "CM League #1", address: null },
  demo_url: "https://demos.test/m-1.dem",
  demo_size: 45 * 1_048_576,
  players,
  mvp: zeta,
  ...o,
})

function profileAnswer() {
  server.use(
    http.get(`${API}/api/v1/me/profile`, () =>
      HttpResponse.json({ player: { id: "me" }, teams: [] })
    )
  )
}

const wrap = (ui: ReactNode) => <TooltipProvider>{ui}</TooltipProvider>

describe("sala de un mix terminado", () => {
  it("marcador, demo, Δ ELO, MVP, invitado y la fila del usuario", async () => {
    profileAnswer()
    server.use(
      http.get(`${API}/api/v1/matches/m-1`, () => HttpResponse.json(detail()))
    )
    renderWithQuery(wrap(<MixMatchRoom id="m-1" />))

    expect(await screen.findByText("FINAL")).toBeVisible()
    expect(screen.getByText("16 : 12")).toBeVisible()
    expect(screen.getByText("de_tuscan · rondas")).toBeVisible()
    expect(
      screen.getByRole("link", { name: "Descargar demo (45 MB)" })
    ).toHaveAttribute("href", "https://demos.test/m-1.dem")

    const a = screen.getByRole("region", { name: "Bando Zeta" })
    expect(within(a).getByText("Victoria")).toBeVisible()
    expect(within(a).getByText("MVP")).toBeVisible()
    expect(within(a).getByText("INVITADO")).toBeVisible()
    expect(within(a).getAllByText("+24")).toHaveLength(2)
    await waitFor(() =>
      expect(within(a).getByText("Zeta").closest("tr")).toHaveClass(
        "bg-primary/6"
      )
    )
    const b = screen.getByRole("region", { name: "Bando Vasco" })
    expect(within(b).getByText("Derrota")).toBeVisible()
    expect(within(b).getByText("-24")).toBeVisible()
    // Sin sesión de admin no se ofrece borrar.
    expect(screen.queryByRole("button", { name: "Borrar este mix" })).toBeNull()
  })

  it("cancelado por caída: aviso, sin Δ ELO y la demo deshabilitada", async () => {
    profileAnswer()
    server.use(
      http.get(`${API}/api/v1/matches/m-1`, () =>
        HttpResponse.json(
          detail({
            status: "cancelled",
            winner_side: null,
            cancel_reason: "crash",
            review: "pending",
            demo_status: "none",
            demo_url: null,
            demo_size: null,
          })
        )
      )
    )
    renderWithQuery(wrap(<MixMatchRoom id="m-1" />))
    expect(await screen.findByText("CANCELADO")).toBeVisible()
    expect(screen.getByText("Interrumpida")).toBeVisible()
    expect(
      screen.getByText(/Un admin tiene que decidir si cuenta para el ELO/)
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Sin demo" })).toBeDisabled()
    expect(screen.queryByText("MVP")).toBeNull()
    expect(screen.queryByText("+24")).toBeNull()
  })

  it("sin foto en la maestra la franja queda lisa", async () => {
    profileAnswer()
    server.use(
      http.get(`${API}/api/v1/matches/m-1`, () => HttpResponse.json(detail()))
    )
    const { container } = renderWithQuery(wrap(<MixMatchRoom id="m-1" />))
    await screen.findByText("FINAL")
    // La maestra todavía no está en la API: sin foto.
    expect(container.querySelector("[data-photo]")).toBeNull()
  })
})

describe("sala en vivo", () => {
  const live = {
    uid: "lv-1",
    server: { id: "s1", name: "CM League #1" },
    map: "de_inferno",
    side1: { name: "Bando Kai", score: 9 },
    side2: { name: "Bando Nube", score: 7 },
    rounds_played: 16,
    max_rounds: 24,
    started_at: new Date(Date.now() - 24 * 60_000).toISOString(),
    updated_at: new Date().toISOString(),
    stale: false,
    parent_match_id: null,
    tv: { host: "45.235.98.12", port: 27020 },
    seq: 16,
    rounds: [],
    // Las líneas en vivo no traen elo_delta; si viniera, la sala no lo muestra igual.
    players,
  }

  it("EN VIVO, ronda, Ver en CM League TV y Δ ELO en —", async () => {
    profileAnswer()
    server.use(
      http.get(`${API}/api/v1/mixes/live/lv-1`, () =>
        HttpResponse.json(live, { headers: { ETag: '"16"' } })
      )
    )
    renderWithQuery(wrap(<MixLiveRoom uid="lv-1" />))
    expect(await screen.findByText("EN VIVO")).toBeVisible()
    expect(
      screen.getByText(/de_inferno · ronda 17 · empezó hace 24 minutos/)
    ).toBeVisible()
    expect(
      screen.getByRole("link", { name: "Ver en CM League TV" })
    ).toHaveAttribute("href", "steam://connect/45.235.98.12:27020")
    expect(screen.getAllByText("En juego")).toHaveLength(2)
    expect(screen.queryByText("+24")).toBeNull()
  })

  it("404: el mix terminó", async () => {
    profileAnswer()
    server.use(
      http.get(`${API}/api/v1/mixes/live/lv-9`, () =>
        HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "No está en vivo." } },
          { status: 404 }
        )
      )
    )
    renderWithQuery(wrap(<MixLiveRoom uid="lv-9" />))
    expect(await screen.findByText("Este mix terminó.")).toBeVisible()
    expect(screen.getByRole("link", { name: "Ver mixes" })).toBeVisible()
  })

  it("con If-None-Match, un 304 reusa la última foto", async () => {
    const seen: (string | null)[] = []
    server.use(
      http.get(`${API}/api/v1/mixes/live/lv-5`, ({ request }) => {
        const tag = request.headers.get("If-None-Match")
        seen.push(tag)
        return tag
          ? new HttpResponse(null, { status: 304 })
          : HttpResponse.json(
              { ...live, uid: "lv-5" },
              { headers: { ETag: '"16"' } }
            )
      })
    )
    const first = await fetchLiveMix("lv-5")
    const second = await fetchLiveMix("lv-5")
    expect(seen).toEqual([null, '"16"'])
    expect(second).toBe(first)
  })
})

describe("DeleteMixDialog", () => {
  it("pide 'estoy seguro', manda la elección del ELO y avisa", async () => {
    const sent = vi.fn()
    server.use(
      http.delete(`${API}/api/v1/admin/mixes/m-1`, async ({ request }) => {
        sent(await request.json())
        return HttpResponse.json({ elo_mode: "revert", players: 10 })
      })
    )
    const { user } = renderWithQuery(<DeleteMixDialog matchId="m-1" movedElo />)
    await user.click(screen.getByRole("button", { name: "Borrar este mix" }))
    const confirm = screen.getByRole("button", { name: "Borrar mix" })
    expect(confirm).toBeDisabled()

    await user.click(screen.getByRole("radio", { name: /Revertir el ELO/ }))
    await user.type(screen.getByLabelText(/para confirmar/), "estoy segur")
    expect(confirm).toBeDisabled()
    await user.type(screen.getByLabelText(/para confirmar/), "o")
    await user.click(confirm)

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Mix borrado. ELO revertido.")
    )
    expect(sent).toHaveBeenCalledWith({
      elo: "revert",
      confirm: "estoy seguro",
    })
    expect(navigate).toHaveBeenCalledWith({ to: "/mixes" })
  })

  it("en un cancelado no hay elección; un error de la API se muestra sin cerrar", async () => {
    server.use(
      http.delete(`${API}/api/v1/admin/mixes/m-2`, () =>
        HttpResponse.json(
          {
            error: {
              code: "BUSINESS_RULE",
              message: "El mix está vinculado a una partida de torneo.",
            },
          },
          { status: 400 }
        )
      )
    )
    const { user } = renderWithQuery(
      <DeleteMixDialog matchId="m-2" movedElo={false} />
    )
    await user.click(screen.getByRole("button", { name: "Borrar este mix" }))
    expect(screen.queryByRole("radio")).toBeNull()
    await user.type(screen.getByLabelText(/para confirmar/), "estoy seguro")
    await user.click(screen.getByRole("button", { name: "Borrar mix" }))
    expect(
      await screen.findByText("El mix está vinculado a una partida de torneo.")
    ).toBeVisible()
    expect(screen.getByRole("dialog")).toBeVisible()
  })
})
