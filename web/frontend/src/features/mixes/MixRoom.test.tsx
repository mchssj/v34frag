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

const catalogMap = (name: string, o: Record<string, unknown> = {}) => ({
  name,
  versions: [name],
  active: true,
  position: 1,
  mixes: true,
  veto_default: true,
  image_url: null,
  ...o,
})

function mapsAnswer(items: ReturnType<typeof catalogMap>[]) {
  server.use(
    http.get(`${API}/api/v1/maps`, () =>
      HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        per: 100,
        sort: "position",
        order: "asc",
      })
    )
  )
}

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

  it("sin foto en el catálogo la franja queda lisa", async () => {
    profileAnswer()
    mapsAnswer([catalogMap("de_tuscan")])
    server.use(
      http.get(`${API}/api/v1/matches/m-1`, () => HttpResponse.json(detail()))
    )
    const { container } = renderWithQuery(wrap(<MixMatchRoom id="m-1" />))
    await screen.findByText("FINAL")
    expect(container.querySelector("[data-photo]")).toBeNull()
  })

  it("la foto del mapa se busca por versión", async () => {
    profileAnswer()
    mapsAnswer([
      catalogMap("de_inferno", {
        versions: ["de_inferno", "de_inferno_classic"],
        image_url: "https://img.test/inferno.webp",
      }),
    ])
    server.use(
      http.get(`${API}/api/v1/matches/m-1`, () =>
        HttpResponse.json(detail({ map: "de_inferno_classic" }))
      )
    )
    const { container } = renderWithQuery(wrap(<MixMatchRoom id="m-1" />))
    await screen.findByText("FINAL")
    await waitFor(() =>
      expect(container.querySelector("[data-photo] img")).toHaveAttribute(
        "src",
        "https://img.test/inferno.webp"
      )
    )
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

  it("en vivo no hay Δ ELO y Clutch avisa que se cuenta al terminar", async () => {
    profileAnswer()
    server.use(
      http.get(`${API}/api/v1/mixes/live/lv-1`, () =>
        HttpResponse.json(live, { headers: { ETag: '"16"' } })
      )
    )
    const { unmount } = renderWithQuery(wrap(<MixLiveRoom uid="lv-1" />))
    await screen.findByText("EN VIVO")
    expect(
      screen.queryByRole("button", { name: "Ordenar por Δ ELO" })
    ).toBeNull()
    expect(
      screen.getAllByRole("button", { name: "Ordenar por K/R" })
    ).toHaveLength(2)
    unmount()
    renderWithQuery(wrap(<MixLiveRoom uid="lv-1" tab="clutch" />))
    expect(
      await screen.findByText("Los clutches se cuentan al terminar el mix.")
    ).toBeInTheDocument()
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
    expect(navigate).toHaveBeenCalledWith({
      to: "/matches",
      search: { kind: "mix" },
    })
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

describe("pestañas de estadísticas", () => {
  const withStats = (o: Record<string, unknown> = {}) =>
    detail({
      clutch_data: true,
      players: [
        {
          ...zeta,
          k2: 4,
          k3: 1,
          k4: 0,
          k5: 0,
          first_kills: 5,
          first_deaths: 1,
          plants: 2,
          defuses: 0,
          clutches: { 1: 2, 2: 1, 3: 0, 4: 0, 5: 0 },
        },
        {
          ...players[2],
          k2: 1,
          k3: 0,
          k4: 0,
          k5: 0,
          first_kills: 1,
          first_deaths: 4,
          plants: 0,
          defuses: 1,
          clutches: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
      ],
      ...o,
    })

  it("General con las columnas nuevas y el mejor valor marcado; cambiar de pestaña avisa", async () => {
    profileAnswer()
    server.use(
      http.get(`${API}/api/v1/matches/m-1`, () =>
        HttpResponse.json(withStats())
      )
    )
    const onTab = vi.fn()
    const { user } = renderWithQuery(
      wrap(<MixMatchRoom id="m-1" onTab={onTab} />)
    )
    await screen.findByText("FINAL")
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    const a = screen.getByRole("region", { name: "Bando Zeta" })
    for (const h of ["K/R", "HS %", "2k", "5k", "Rating", "Δ ELO"])
      expect(
        within(a).getByRole("button", { name: `Ordenar por ${h}` })
      ).toBeInTheDocument()
    // Zeta tiene más kills (20) que Vasco (9): su celda es la mejor.
    const zetaRow = within(a).getByText("Zeta").closest("tr")!
    expect(zetaRow.querySelectorAll("[data-best]").length).toBeGreaterThan(0)
    await user.click(screen.getByRole("tab", { name: "Avanzado" }))
    expect(onTab).toHaveBeenCalledWith("advanced")
  })

  it("Entrada y Clutch con sus columnas; ordenar por una cabecera", async () => {
    profileAnswer()
    server.use(
      http.get(`${API}/api/v1/matches/m-1`, () =>
        HttpResponse.json(withStats())
      )
    )
    const { unmount, user } = renderWithQuery(
      wrap(<MixMatchRoom id="m-1" tab="entry" />)
    )
    await screen.findByText("FINAL")
    const a = screen.getByRole("region", { name: "Bando Zeta" })
    expect(
      within(a).getByRole("button", { name: "Ordenar por % éxito" })
    ).toBeInTheDocument()
    expect(within(a).getByText("83%")).toBeInTheDocument()
    await user.click(
      within(a).getByRole("button", { name: "Ordenar por Elim." })
    )
    expect(
      within(a)
        .getByRole("button", { name: "Ordenar por Elim." })
        .querySelector("svg")
    ).not.toBeNull()
    unmount()

    renderWithQuery(wrap(<MixMatchRoom id="m-1" tab="clutch" />))
    await screen.findByText("FINAL")
    expect(screen.getByText("Solo clutches ganados.")).toBeInTheDocument()
    const z = screen.getByRole("region", { name: "Bando Zeta" })
    expect(
      within(z).getByRole("button", { name: "Ordenar por 1v5" })
    ).toBeInTheDocument()
  })

  it("Avanzado: bombas con su nombre completo, sin RP; quien jugó menos rondas lo muestra", async () => {
    profileAnswer()
    server.use(
      http.get(`${API}/api/v1/matches/m-1`, () =>
        HttpResponse.json(
          withStats({
            // 14 + 12 = 26 rondas; Vasco entró tarde y jugó 10.
            side1: { name: "Bando Zeta", team: null, score: 14 },
            side2: { name: "Bando Vasco", team: null, score: 12 },
            players: [
              { ...zeta, rounds: 26 },
              { ...players[2], rounds: 10 },
            ],
          })
        )
      )
    )
    renderWithQuery(wrap(<MixMatchRoom id="m-1" tab="advanced" />))
    await screen.findByText("FINAL")
    expect(
      screen.getAllByRole("button", { name: "Ordenar por Bombas plantadas" })
    ).toHaveLength(2)
    expect(
      screen.getAllByRole("button", { name: "Ordenar por Bombas desactivadas" })
    ).toHaveLength(2)
    expect(screen.queryByRole("button", { name: "Ordenar por RP" })).toBeNull()
    expect(screen.getAllByText(/\/26 rondas/)).toHaveLength(1)
    const b = screen.getByRole("region", { name: "Bando Vasco" })
    expect(within(b).getByText("10/26 rondas")).toBeInTheDocument()
  })

  it("Clutch sin datos del servidor", async () => {
    profileAnswer()
    server.use(
      http.get(`${API}/api/v1/matches/m-1`, () =>
        HttpResponse.json(withStats({ clutch_data: false }))
      )
    )
    renderWithQuery(wrap(<MixMatchRoom id="m-1" tab="clutch" />))
    expect(
      await screen.findByText("Sin datos de Clutches disponibles.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Bando Zeta" })).toBeNull()
  })
})
