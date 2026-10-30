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
import type { MixItem } from "@/features/mixes/queries"
import { renderWithQuery } from "@/test/render"
import { MatchesList } from "./MatchesList"
import type { MatchSummary } from "./queries"
import type { MatchesSearch } from "./search"

const navigate = vi.hoisted(() => vi.fn())
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
  // Sin router en la prueba: los links de los vacíos son <a> comunes.
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

const API = "http://api.test"
const asked = vi.fn()
const askedLive = vi.fn()
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

const mix: MatchSummary = {
  id: "m-1",
  kind: "mix",
  status: "finished",
  label: null,
  event: null,
  side1: { name: "Equipo Lukas", team: null, score: 12 },
  side2: { name: "Equipo reN", team: null, score: 16 },
  winner_side: 2,
  best_of: 1,
  map: "nuke_old_blue",
  starts_at: "2026-10-16T04:43:06Z",
  played_at: "2026-10-16T05:26:19Z",
  end_reason: null,
  cancel_reason: null,
  review: null,
  demo_status: "uploaded",
  parent_match_id: null,
}
const series: MatchSummary = {
  ...mix,
  id: "m-2",
  kind: "official",
  label: "Final",
  event: { id: "e1", name: "Copa TITAN" },
  side1: {
    name: "GO TO KNOW",
    team: { id: "t1", name: "GO TO KNOW", tag: "GTK", logo_url: null },
    score: 2,
  },
  side2: {
    name: "STRIX",
    team: { id: "t2", name: "STRIX", tag: "STX", logo_url: null },
    score: 1,
  },
  winner_side: 1,
  best_of: 3,
  map: "?, ?",
  demo_status: "pending",
}

const live: MixItem = {
  match_id: null,
  live_uid: "lv-1",
  status: "live",
  map: "mirage_rc1",
  server: { id: "s1", name: "CMLeague #1" },
  started_at: "2026-10-30T21:00:00Z",
  ended_at: null,
  side1: { name: "Equipo Kai", score: 9 },
  side2: { name: "Equipo Nube", score: 8 },
  winner_side: null,
  rounds_played: 17,
  current_round: 18,
  max_rounds: 24,
  stale: false,
  mvp: null,
  demo_status: "none",
  review: null,
  cancel_reason: null,
  tv: { host: "45.235.98.12", port: 27020 },
}

function answer(
  items: MatchSummary[],
  o: { total?: number; live?: MixItem[] } = {}
) {
  server.use(
    http.get(`${API}/api/v1/matches`, ({ request }) => {
      asked(Object.fromEntries(new URL(request.url).searchParams))
      return HttpResponse.json({
        items,
        total: o.total ?? items.length,
        page: 1,
        per: 15,
        sort: "played_at",
        order: "desc",
      })
    }),
    http.get(`${API}/api/v1/mixes`, ({ request }) => {
      askedLive(Object.fromEntries(new URL(request.url).searchParams))
      const rows = o.live ?? []
      return HttpResponse.json({
        items: rows,
        total: rows.length,
        page: 1,
        per: 20,
        sort: "started_at",
        order: "desc",
      })
    }),
    http.get(`${API}/api/v1/mixes/stats`, () =>
      HttpResponse.json({
        live_now: o.live?.length ?? 0,
        players_recent: 41,
        top_map: "mirage_rc1",
        avg_rounds: 22.2,
        window_days: 30,
      })
    ),
    http.get(`${API}/api/v1/maps`, () =>
      HttpResponse.json({
        items: [
          {
            name: "de_nuke",
            versions: ["de_nuke"],
            active: true,
            position: 2,
            mixes: true,
            veto_default: true,
            image_url: null,
          },
          {
            name: "de_cache",
            versions: ["de_cache"],
            active: true,
            position: 1,
            mixes: false,
            veto_default: true,
            image_url: null,
          },
          {
            name: "de_aztec",
            versions: ["de_aztec"],
            active: false,
            position: 3,
            mixes: false,
            veto_default: false,
            image_url: null,
          },
        ],
        total: 3,
        page: 1,
        per: 100,
        sort: "position",
        order: "asc",
      })
    )
  )
}

function renderList(search: MatchesSearch = {}, onChange = vi.fn()) {
  const wrap = (ui: ReactNode) => <TooltipProvider>{ui}</TooltipProvider>
  return {
    onChange,
    ...renderWithQuery(
      wrap(<MatchesList search={search} onChange={onChange} />)
    ),
  }
}

const row = (name: RegExp) => screen.getByRole("link", { name })

describe("MatchesList", () => {
  it("cabecera, KPIs, en vivo en filas completas y la tabla con los tres tipos", async () => {
    answer([mix, series], { live: [live] })
    renderList()

    expect(screen.getByRole("heading", { name: "Partidas" })).toBeVisible()
    expect(await screen.findByText("41")).toBeVisible()

    // En vivo: fila completa con marcador, ronda, servidor y Ver en TV.
    const block = await screen.findByRole("region", { name: "En vivo" })
    expect(within(block).getByText("En vivo · 1")).toBeVisible()
    const liveRow = within(block).getByRole("link", {
      name: /Equipo Kai contra/,
    })
    expect(within(liveRow).getByText("9 : 8")).toBeVisible()
    expect(
      within(liveRow).getByText(/Ronda 18 de 24 · CMLeague #1/)
    ).toBeVisible()
    expect(
      within(liveRow).getByRole("link", { name: "Ver en TV" })
    ).toHaveAttribute("href", "steam://connect/45.235.98.12:27020")

    // Mix: el ganador en negrita, demo disponible; sin escudos ni nivel.
    const m = row(/^Equipo Lukas contra/)
    expect(within(m).getByText("Mix")).toBeVisible()
    expect(within(m).getByText("Equipo reN")).toHaveClass("font-semibold")
    expect(within(m).getByText("Equipo Lukas")).not.toHaveClass("font-semibold")
    expect(within(m).getByText("Disponible")).toBeVisible()

    // Serie de torneo: el formato en lugar del mapa, y el torneo con su fase.
    const s = row(/^GO TO KNOW contra/)
    expect(within(s).getByText("BO3")).toBeVisible()
    expect(within(s).getByText("Copa TITAN · Final")).toBeVisible()
    expect(within(s).getByText("Subiendo")).toBeVisible()
    expect(within(s).queryByText("GTK")).toBeNull()
  })

  it("solo jugadas: pide finished y manda tipo, búsqueda y mapa sin de_", async () => {
    answer([mix])
    renderList({ kind: "mix", q: "lukas", map: "de_nuke", page: 2, per: 25 })
    await screen.findByText("Equipo reN")
    expect(asked).toHaveBeenCalledWith({
      page: "2",
      per: "25",
      status: "finished",
      sort: "played_at",
      order: "desc",
      kind: "mix",
      q: "lukas",
      map: "nuke",
    })
    expect(askedLive).toHaveBeenCalledWith({ status: "live", per: "20" })
  })

  it("con PCW o Torneo no se muestra el bloque En vivo", async () => {
    answer([series], { live: [live] })
    renderList({ kind: "official" })
    await screen.findByText("Copa TITAN · Final")
    expect(screen.queryByRole("region", { name: "En vivo" })).toBeNull()
    expect(askedLive).not.toHaveBeenCalled()
  })

  it("los chips de tipo cambian la URL y vuelven a la página 1", async () => {
    answer([mix])
    const { user, onChange } = renderList({ page: 3 })
    const tipo = screen.getByRole("group", { name: "Tipo" })
    await user.click(within(tipo).getByRole("button", { name: "Torneo" }))
    expect(onChange).toHaveBeenLastCalledWith({
      kind: "official",
      page: undefined,
    })
    await user.click(within(tipo).getByRole("button", { name: "Todas" }))
    expect(onChange).toHaveBeenLastCalledWith({
      kind: undefined,
      page: undefined,
    })
  })

  it("Solo donde jugué y Ocultar canceladas esperan al backend", async () => {
    answer([mix])
    renderList()
    await screen.findByText("Equipo reN")
    expect(
      screen.getByRole("button", { name: "Solo donde jugué" })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Ocultar canceladas" })
    ).toBeDisabled()
  })

  it("la fila abre la sala; la de en vivo, la sala en vivo; Ver en TV no navega", async () => {
    answer([mix], { live: [live] })
    const { user } = renderList()
    await user.click(await screen.findByRole("link", { name: "Ver en TV" }))
    expect(navigate).not.toHaveBeenCalled()
    await user.click(row(/^En vivo: Equipo Kai contra/))
    expect(navigate).toHaveBeenLastCalledWith({
      to: "/mixes/live/$uid",
      params: { uid: "lv-1" },
    })
    await user.click(row(/^Equipo Lukas contra/))
    expect(navigate).toHaveBeenLastCalledWith({
      to: "/match/$id",
      params: { id: "m-1" },
    })
  })

  it("el buscador pasa a la URL con debounce", async () => {
    answer([mix])
    const { user, onChange } = renderList()
    await user.type(screen.getByLabelText("Buscar partidas"), "copa")
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({ q: "copa", page: undefined })
    )
  })

  it("select de mapa: los activos del catálogo, en su orden", async () => {
    answer([mix])
    const { user, onChange } = renderList()
    await user.click(await screen.findByRole("combobox", { name: "Mapa" }))
    const options = screen.getAllByRole("option").map((o) => o.textContent)
    expect(options).toEqual(["Todos los mapas", "de_cache", "de_nuke"])
    await user.click(screen.getByRole("option", { name: "de_nuke" }))
    expect(onChange).toHaveBeenCalledWith({ map: "de_nuke", page: undefined })
  })

  it("vacíos: con filtros ofrece quitarlos; sin PCW lleva a PCW", async () => {
    answer([])
    const { user, onChange, unmount } = renderList({ q: "zzz" })
    expect(
      await screen.findByText("Ninguna partida con esos filtros")
    ).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Quitar filtros" }))
    expect(onChange).toHaveBeenLastCalledWith({
      q: undefined,
      map: undefined,
      page: undefined,
    })
    unmount()
    renderList({ kind: "pcw" })
    expect(
      await screen.findByText("Todavía no se jugó ningún PCW")
    ).toBeVisible()
    expect(screen.getByRole("link", { name: "Ir a PCW" })).toBeVisible()
    // Sin partidas no hay paginación.
    expect(screen.queryByText(/^Mostrando/)).toBeNull()
  })

  it("paginación: rango y siguiente", async () => {
    answer([mix], { total: 40 })
    const { user, onChange } = renderList({ page: 2 })
    expect(await screen.findByText("Mostrando 16–30 de 40")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Página siguiente" }))
    expect(onChange).toHaveBeenLastCalledWith({ page: 3 })
  })
})
