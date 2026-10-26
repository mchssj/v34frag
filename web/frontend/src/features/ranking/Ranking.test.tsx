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
import { Compare } from "./Compare"
import { PlayersRanking } from "./PlayersRanking"
import { TeamsRanking } from "./TeamsRanking"

const navigate = vi.hoisted(() => vi.fn())
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

const page = <T,>(items: T[]) => ({
  items,
  total: items.length,
  page: 1,
  per: 25,
  sort: "x",
  order: "asc",
})

const beta = {
  id: "s1",
  number: 1,
  name: "BETA",
  status: "active",
  starts_at: "2026-10-13T00:00:00Z",
  ends_at: "2099-11-23T09:00:00Z",
  closed_at: null,
  top_n: 20,
  min_matches: 20,
  reset_pct: 10,
  reset_floor: 2001,
  tiers: [],
  champion: null,
  medals: 0,
}

const standing = (alias: string, o: Record<string, unknown> = {}) => ({
  rank: 1,
  player: { id: alias, alias, photo_url: null },
  eligible: true,
  elo: 1100,
  level: 5,
  peak_elo: 1120,
  matches: 22,
  wins: 12,
  losses: 10,
  elo_after: 1100,
  medal: { name: "Campeón", icon: "🏆" },
  teams: [],
  rating: 1.21,
  kd: 1.15,
  ...o,
})

const ranked = (alias: string, o: Record<string, unknown> = {}) => ({
  position: 1,
  player: { id: alias, alias, photo_url: null },
  level: 5,
  elo: 1182,
  teams: [{ id: "t1", name: "GO TO KNOW", tag: "GTK" }],
  rating: 1.67,
  kd: 2.01,
  matches: 13,
  elo_matches: 13,
  country: "Argentina",
  game_role: "AWPer",
  elo_trend: [1000, 1050, 1182],
  ...o,
})

const profile = {
  user: {},
  details: {},
  player: { id: "me", nick: "Zeta", photo_url: null, steam_id: null },
  teams: [
    {
      id: "t1",
      name: "GO TO KNOW",
      tag: "GTK",
      is_captain: true,
      is_member: true,
    },
    { id: "t2", name: "Brava", tag: "BRV", is_captain: false, is_member: true },
  ],
  matches_played: 0,
  preferences: {},
}

function common() {
  server.use(
    http.get(`${API}/api/v1/me/profile`, () => HttpResponse.json(profile)),
    http.get(`${API}/api/v1/seasons`, () => HttpResponse.json(page([beta])))
  )
}

function renderPlayers(search = {}) {
  const onChange = vi.fn()
  const r = renderWithQuery(
    <TooltipProvider>
      <PlayersRanking search={search} onChange={onChange} />
    </TooltipProvider>
  )
  return { ...r, onChange }
}

describe("Ranking → Jugadores", () => {
  it("abre la temporada activa: franja, puesto, medalla y los sin puesto con su avance", async () => {
    common()
    server.use(
      http.get(`${API}/api/v1/seasons/current`, () => HttpResponse.json(beta)),
      http.get(`${API}/api/v1/seasons/s1/standings`, ({ request }) => {
        const eligible = new URL(request.url).searchParams.get("eligible")
        return HttpResponse.json(
          page(
            eligible
              ? [standing("juanma")]
              : [
                  standing("juanma"),
                  standing("Zeta", {
                    player: { id: "me", alias: "Zeta", photo_url: null },
                    rank: 2,
                    medal: null,
                    elo: 2100,
                    elo_after: 2011,
                  }),
                  standing("musul", {
                    rank: null,
                    eligible: false,
                    matches: 12,
                    medal: null,
                    rating: null,
                    kd: null,
                  }),
                ]
          )
        )
      })
    )
    renderPlayers()

    expect(await screen.findByText("EN CURSO")).toBeInTheDocument()
    expect(screen.getByText(/Top 20 con medalla/)).toBeInTheDocument()
    expect(
      await screen.findByRole("columnheader", { name: "Medalla si cierra hoy" })
    ).toBeInTheDocument()

    const musul = await within(await screen.findByRole("table")).findByRole(
      "link",
      { name: "musul" }
    )
    expect(within(musul).getByText("12/20")).toBeInTheDocument()
    // Sin puesto, sin rating, sin K/D y sin medalla.
    expect(within(musul).getAllByText("—")).toHaveLength(4)
    expect(within(musul).getByText("Sin equipo")).toBeInTheDocument()

    // El usuario resaltado y el reinicio del nivel 10 "si cerrara hoy".
    const me = within(screen.getByRole("table")).getByRole("link", {
      name: "Zeta",
    })
    expect(me).toHaveAttribute("aria-current", "true")
    expect(within(me).getByText("2011")).toBeInTheDocument()

    // El podio son los 3 primeros con puesto.
    const podium = await screen.findByRole("list", { name: "Podio" })
    expect(within(podium).getByText("juanma")).toBeInTheDocument()
  })

  it("temporada: equipo, rating, K/D, pico debajo del ELO, filtro de nivel y orden", async () => {
    common()
    const asked = vi.fn()
    server.use(
      http.get(`${API}/api/v1/seasons/current`, () => HttpResponse.json(beta)),
      http.get(`${API}/api/v1/seasons/s1/standings`, ({ request }) => {
        asked(Object.fromEntries(new URL(request.url).searchParams))
        return HttpResponse.json(
          page([
            standing("flow", {
              teams: [
                { id: "t1", name: "Furia Sur", tag: "FUR" },
                { id: "t2", name: "Los Pibes", tag: "LP" },
                { id: "t3", name: "Mix Norte", tag: "MN" },
              ],
              rating: 1.152,
              kd: 1.19,
              elo: 1890,
              peak_elo: 1932,
            }),
          ])
        )
      })
    )
    const { user, onChange } = renderPlayers({ level: "7-9", sort: "kd" })

    const flow = await within(await screen.findByRole("table")).findByRole(
      "link",
      { name: "flow" }
    )
    expect(within(flow).getByText("Furia Sur")).toBeInTheDocument()
    expect(
      within(flow).getByLabelText("También en Los Pibes, Mix Norte")
    ).toHaveTextContent("+2")
    expect(within(flow).getByText("1.15")).toBeInTheDocument()
    expect(within(flow).getByText("1.19")).toBeInTheDocument()
    expect(within(flow).getByText("máx. 1932")).toBeInTheDocument()
    expect(
      screen.queryByRole("columnheader", { name: "Pico" })
    ).not.toBeInTheDocument()
    expect(asked).toHaveBeenCalledWith(
      expect.objectContaining({ level: "7-9", sort: "kd", order: "desc" })
    )

    await user.click(screen.getByRole("button", { name: "Nivel 10" }))
    expect(onChange).toHaveBeenLastCalledWith({ level: "10", page: undefined })
    await user.click(screen.getByRole("button", { name: /Rating/ }))
    expect(onChange).toHaveBeenLastCalledWith({
      sort: "rating",
      order: undefined,
      page: undefined,
    })
  })

  it("sin temporada activa abre el Histórico", async () => {
    common()
    server.use(
      http.get(`${API}/api/v1/seasons/current`, () =>
        HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "No hay" } },
          { status: 404 }
        )
      ),
      http.get(`${API}/api/v1/ranking/players`, () =>
        HttpResponse.json(
          page([
            ranked("musul", {
              teams: [
                { id: "t1", name: "GO TO KNOW", tag: "GTK" },
                { id: "t3", name: "OLDteam", tag: "" },
              ],
            }),
          ])
        )
      )
    )
    renderPlayers()

    expect(
      await screen.findByText(
        "Todas las partidas jugadas en el servidor, sin temporadas."
      )
    ).toBeInTheDocument()
    const row = await within(await screen.findByRole("table")).findByRole(
      "link",
      { name: "musul" }
    )
    expect(within(row).getByText("AWPer · Argentina")).toBeInTheDocument()
    expect(
      within(row).getByRole("button", { name: "También en OLDteam" })
    ).toHaveTextContent("+1")
    expect(
      within(row).getByRole("img", { name: "Sube en sus últimos mixes" })
    ).toBeInTheDocument()
  })

  it("el podio no cambia al filtrar por nivel", async () => {
    common()
    const asked: string[] = []
    server.use(
      http.get(`${API}/api/v1/ranking/players`, ({ request }) => {
        const p = new URL(request.url).searchParams
        asked.push(p.toString())
        return HttpResponse.json(
          page(p.get("per") === "3" ? [ranked("musul")] : [ranked("nacho")])
        )
      })
    )
    const { user, onChange } = renderPlayers({ season: "all", level: "1-6" })

    const podium = await screen.findByRole("list", { name: "Podio" })
    expect(within(podium).getByText("musul")).toBeInTheDocument()
    await screen.findByRole("link", { name: "nacho" })
    // El podio se pide sin filtros; la tabla con el nivel.
    expect(asked).toContain("per=3")
    expect(asked.some((q) => q.includes("level=1-6"))).toBe(true)

    await user.click(screen.getByRole("button", { name: "Nivel 10" }))
    expect(onChange).toHaveBeenCalledWith({ level: "10", page: undefined })
  })

  it("clic en una fila abre el perfil", async () => {
    common()
    server.use(
      http.get(`${API}/api/v1/ranking/players`, () =>
        HttpResponse.json(page([ranked("musul")]))
      )
    )
    const { user } = renderPlayers({ season: "all" })
    await user.click(
      await within(await screen.findByRole("table")).findByRole("link", {
        name: "musul",
      })
    )
    expect(navigate).toHaveBeenCalledWith({
      to: "/player/$nick",
      params: { nick: "musul" },
    })
  })
})

describe("Ranking → Equipos", () => {
  const team = (name: string, id: string, o: Record<string, unknown> = {}) => ({
    position: 1,
    team: { id, name, tag: name.slice(0, 3).toUpperCase() },
    played: 10,
    won: 7,
    lost: 3,
    points: 210,
    win_rate: 70,
    trend: 2,
    form: ["W", "L", "W", "W", "W"],
    ...o,
  })

  it("marca todos los equipos del usuario y arma la leyenda con los puntos de la API", async () => {
    server.use(
      http.get(`${API}/api/v1/me/profile`, () => HttpResponse.json(profile)),
      http.get(`${API}/api/v1/ranking/teams`, ({ request }) => {
        const pcw = new URL(request.url).searchParams.get("pcw") === "1"
        return HttpResponse.json({
          ...page([
            team("GO TO KNOW", "t1"),
            team("Brava", "t2", { trend: null }),
            team("Kraken", "t9", { trend: -1 }),
          ]),
          pcw,
          points_per_win: { official: 30, pcw: 5 },
        })
      })
    )
    renderWithQuery(
      <TooltipProvider>
        <TeamsRanking search={{ pcw: true }} onChange={vi.fn()} />
      </TooltipProvider>
    )

    expect(await screen.findAllByText("TU EQUIPO")).toHaveLength(2)
    expect(
      screen.getByText(
        "Puntos por partida ganada en torneos y en PCW jugadas como equipo oficial."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "30 pts por partida de torneo ganada · 5 pts por PCW ganada como equipo oficial"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Hace 30 días: 3.º")).toBeInTheDocument()
    expect(screen.getByText("Sin partidas hace 30 días")).toBeInTheDocument()
  })
})

describe("Comparador", () => {
  const side = (alias: string, elo: number) => ({
    player: { id: alias, alias, photo_url: null },
    teams: [],
    game_role: "IGL",
    level: 5,
    elo,
    rating: 1.2,
    kd: 1.1,
    hs: 50,
    adr: 80,
    win_rate: 55,
    matches: 20,
    elo_matches: 20,
    elo_history: [1000, elo],
  })

  it("sin B pide elegir un jugador, con A por defecto el usuario", async () => {
    server.use(
      http.get(`${API}/api/v1/me/profile`, () => HttpResponse.json(profile))
    )
    renderWithQuery(<Compare search={{}} onChange={vi.fn()} />)
    expect(
      await screen.findByText("Elige un jugador para comparar con Zeta.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "Jugador A" })
    ).toHaveTextContent("Zeta")
  })

  it("muestra filas, gráfico y los mixes juntos y como rivales", async () => {
    server.use(
      http.get(`${API}/api/v1/me/profile`, () => HttpResponse.json(profile)),
      http.get(`${API}/api/v1/players/compare`, () =>
        HttpResponse.json({
          a: side("Zeta", 1200),
          b: side("kova", 1100),
          together: {
            same_team: { matches: 7, wins: 4 },
            against: { matches: 3, a_wins: 2 },
          },
        })
      )
    )
    renderWithQuery(<Compare search={{ b: "kova" }} onChange={vi.fn()} />)
    expect(
      await screen.findByRole("img", { name: /ELO de Zeta y kova/ })
    ).toBeInTheDocument()
    expect(screen.getByText(/Mixes jugados juntos:/)).toHaveTextContent(
      "Mixes jugados juntos: 7 · ganaron 4"
    )
    expect(screen.getByText(/Como rivales:/)).toHaveTextContent(
      "Como rivales: 3 · Zeta ganó 2"
    )
  })

  it("un jugador que no existe", async () => {
    server.use(
      http.get(`${API}/api/v1/me/profile`, () => HttpResponse.json(profile)),
      http.get(`${API}/api/v1/players/compare`, () =>
        HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "No existe" } },
          { status: 404 }
        )
      )
    )
    renderWithQuery(<Compare search={{ b: "nadie" }} onChange={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByText("Ese jugador no existe.")).toBeInTheDocument()
    )
  })
})
