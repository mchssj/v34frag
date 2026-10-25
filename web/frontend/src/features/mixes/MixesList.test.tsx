import { screen, waitFor, within } from "@testing-library/react"
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
import { renderWithQuery } from "@/test/render"
import { MixesList } from "./MixesList"
import type { MixItem } from "./queries"
import type { MixesSearch } from "./search"

const navigate = vi.hoisted(() => vi.fn())
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
}))

const API = "http://api.test"
const asked = vi.fn()
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

const base: MixItem = {
  match_id: null,
  live_uid: null,
  status: "finished",
  map: "de_dust2",
  server: { id: "s1", name: "CM League #1" },
  started_at: "2026-10-24T21:30:00Z",
  ended_at: null,
  side1: { name: "Bando Zeta", score: 16 },
  side2: { name: "Bando Vasco", score: 12 },
  winner_side: 1,
  rounds_played: 28,
  current_round: null,
  max_rounds: 24,
  stale: false,
  mvp: {
    player_id: "p1",
    alias: "Zeta",
    game_nick: "zeta",
    elo: 1612,
    level: 8,
    rating: 1.42,
  },
  demo_status: "uploaded",
  cancel_reason: null,
  tv: null,
}

const liveTv: MixItem = {
  ...base,
  match_id: null,
  live_uid: "lv-1",
  status: "live",
  map: "de_inferno",
  side1: { name: "Bando Kai", score: 9 },
  side2: { name: "Bando Nube", score: 7 },
  winner_side: null,
  current_round: 17,
  tv: { host: "45.235.98.12", port: 27020 },
}
const liveStale: MixItem = {
  ...liveTv,
  live_uid: "lv-2",
  map: "de_nuke",
  side1: { name: "Bando Rayo", score: 4 },
  side2: { name: "Bando Toto", score: 6 },
  server: { id: "s2", name: "RBK" },
  current_round: 11,
  stale: true,
  tv: null,
}
const finished: MixItem = { ...base, match_id: "m-1" }
const cancelled: MixItem = {
  ...base,
  match_id: "m-2",
  status: "cancelled",
  map: "de_train",
  side1: { name: "Bando Gato", score: 3 },
  side2: { name: "Bando Lince", score: 2 },
  winner_side: null,
  cancel_reason: "crash",
  demo_status: "none",
}

function answer(items: MixItem[], total = items.length) {
  server.use(
    http.get(`${API}/api/v1/mixes`, ({ request }) => {
      asked(Object.fromEntries(new URL(request.url).searchParams))
      return HttpResponse.json({
        items,
        total,
        page: 1,
        per: 15,
        sort: "started_at",
        order: "desc",
      })
    }),
    http.get(`${API}/api/v1/mixes/stats`, () =>
      HttpResponse.json({
        live_now: 2,
        players_recent: 214,
        top_map: "de_dust2",
        avg_rounds: 26.4,
        window_days: 30,
      })
    )
  )
}

function renderList(search: MixesSearch = {}, onChange = vi.fn()) {
  const wrap = (ui: ReactNode) => <TooltipProvider>{ui}</TooltipProvider>
  return {
    onChange,
    ...renderWithQuery(wrap(<MixesList search={search} onChange={onChange} />)),
  }
}

const row = (name: RegExp) => screen.getByRole("link", { name })

describe("MixesList", () => {
  it("cabecera, KPIs con 30 días y filas de cada tipo", async () => {
    answer([liveTv, liveStale, finished, cancelled])
    renderList()

    expect(screen.getByRole("heading", { name: "Mixes" })).toBeVisible()
    expect(
      await screen.findByText("Jugadores en los últimos 30 días")
    ).toBeVisible()
    expect(await screen.findByText("214")).toBeVisible()
    expect(screen.getByText("26.4")).toBeVisible()

    // En vivo con TV: chip, ronda y botón con el link de Steam.
    const live = await screen.findByRole("link", { name: /Bando Kai contra/ })
    expect(within(live).getByText("EN VIVO")).toBeVisible()
    expect(within(live).getByText("Ronda 17 · CM League #1")).toBeVisible()
    expect(
      within(live).getByRole("link", { name: "Ver en TV" })
    ).toHaveAttribute("href", "steam://connect/45.235.98.12:27020")

    // En vivo sin TV y sin novedades: sin botón, atenuado.
    const stale = row(/Bando Rayo contra/)
    expect(within(stale).queryByText("Ver en TV")).toBeNull()
    expect(
      within(stale).getByText(/Ronda 11 · RBK · Sin novedades del servidor/)
    ).toBeVisible()
    expect(stale).toHaveClass("opacity-60")

    // Terminada: ganador en negrita, MVP con nivel y rating, demo disponible.
    const done = row(/Bando Zeta contra/)
    expect(within(done).getByText("Bando Zeta")).toHaveClass("font-semibold")
    expect(within(done).getByText("Bando Vasco")).not.toHaveClass(
      "font-semibold"
    )
    expect(within(done).getByTitle("Nivel 8")).toBeVisible()
    expect(within(done).getByText("1.42")).toBeVisible()
    expect(within(done).getByText("Disponible")).toBeVisible()

    // Cancelada por caída: chip con el motivo traducido.
    expect(
      within(row(/Bando Gato contra/)).getByText("Cancelada · Interrumpida")
    ).toBeVisible()
  })

  it("la fila abre su sala; Ver en TV no navega", async () => {
    answer([liveTv, finished])
    const { user } = renderList()

    await user.click(await screen.findByRole("link", { name: "Ver en TV" }))
    expect(navigate).not.toHaveBeenCalled()

    await user.click(row(/Bando Kai contra/))
    expect(navigate).toHaveBeenLastCalledWith({
      to: "/mixes/live/$uid",
      params: { uid: "lv-1" },
    })
    await user.click(row(/Bando Zeta contra/))
    expect(navigate).toHaveBeenLastCalledWith({
      to: "/match/$id",
      params: { id: "m-1" },
    })
  })

  it("los toggles cambian la URL y vuelven a la página 1", async () => {
    answer([finished])
    const { user, onChange } = renderList({ page: 3 })
    await user.click(
      await screen.findByRole("button", { name: "Solo donde jugué" })
    )
    expect(onChange).toHaveBeenLastCalledWith({ mine: true, page: undefined })
    await user.click(screen.getByRole("button", { name: "Ocultar canceladas" }))
    expect(onChange).toHaveBeenLastCalledWith({
      hideCancel: true,
      page: undefined,
    })
  })

  it("manda los filtros de la URL a la API", async () => {
    answer([])
    renderList({ q: "zeta", mine: true, hideCancel: true, page: 2, per: 25 })
    expect(
      await screen.findByText("No hay mixes con esos filtros.")
    ).toBeVisible()
    expect(asked).toHaveBeenCalledWith({
      q: "zeta",
      mine: "true",
      hide_cancelled: "true",
      page: "2",
      per: "25",
    })
  })

  it("el buscador pasa a la URL con debounce", async () => {
    answer([finished])
    const { user, onChange } = renderList()
    await user.type(screen.getByLabelText("Buscar mixes"), "nuke")
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({ q: "nuke", page: undefined })
    )
  })

  it("paginación: rango, página actual y siguiente", async () => {
    answer([finished], 40)
    const { user, onChange } = renderList({ page: 2 })
    expect(await screen.findByText("Mostrando 16–30 de 40")).toBeVisible()
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    await user.click(screen.getByRole("button", { name: "Página siguiente" }))
    expect(onChange).toHaveBeenLastCalledWith({ page: 3 })
    await user.click(screen.getByRole("button", { name: "Página anterior" }))
    expect(onChange).toHaveBeenLastCalledWith({ page: undefined })
  })

  it("sin maestra de mapas no hay select de mapa", async () => {
    answer([finished])
    renderList()
    await screen.findByText("Disponible")
    expect(screen.queryByRole("combobox", { name: "Mapa" })).toBeNull()
  })
})
