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

import { TooltipProvider } from "@/components/ui/tooltip"
import { renderWithQuery } from "@/test/render"
import { PlayerProfile } from "./PlayerProfile"
import type { PlayerSearch } from "./search"

const navigate = vi.hoisted(() => vi.fn())
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
  Link: ({
    to,
    children,
    params,
    search,
    ...rest
  }: {
    to: string
    params?: unknown
    search?: unknown
    children: ReactNode
  } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) => {
    void params
    void search
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
  per: 20,
  sort: "x",
  order: "desc",
})

const details = {
  avatar_url: null,
  real_name: "Martín Ruiz",
  country: "Argentina",
  game_role: "IGL",
  steam: "STEAM_0:0:797529184",
  faceit: "kyantares",
  discord: "zeta.ar",
  joined_at: "2026-03-14T12:00:00Z",
  last_seen: "2026-10-24T20:00:00Z",
}

const detail = (o: Record<string, unknown> = {}) => ({
  id: "p1",
  alias: "Zeta",
  has_account: true,
  has_steam: true,
  photo_url: null,
  elo: 1062,
  level: 5,
  elo_matches: 20,
  maps: 20,
  rating: 1.24,
  kd: 1.3,
  wins: 10,
  losses: 10,
  teams: [
    { id: "t1", name: "Furia Sur", tag: "FUR" },
    { id: "t2", name: "Brava", tag: "BRV" },
  ],
  steam_id: null,
  steam_ids: [],
  bio: "IGL desde 2024.",
  achievements: "Campeón Liga Apertura 2025",
  team_history_text: "ARVUM\nSOVIET",
  privacy: "public",
  peak_elo: 1078,
  stats: {
    maps: 20,
    rounds: 472,
    kills: 428,
    deaths: 330,
    assists: 74,
    damage: 44676,
    rating: 1.24,
    kd: 1.3,
    hs: 54.9,
    adr: 94.7,
    wins: 10,
    losses: 10,
  },
  details,
  private: false,
  ...o,
})

const match = {
  match_id: "m1",
  kind: "mix",
  played_at: "2026-10-24T21:30:00Z",
  map: "de_dust2",
  side1_name: "A",
  side2_name: "B",
  score1: 16,
  score2: 3,
  side: 1,
  won: true,
  parent_match_id: null,
  game_nick: "zeta",
  kills: 12,
  deaths: 10,
  assists: 1,
  headshots: 5,
  damage: 1200,
  rounds: 19,
  rating: 1.11,
  elo_before: 1035,
  elo_after: 1062,
  elo_delta: 27,
  demo_status: null,
  event: null,
  label: null,
}

function api(
  o: {
    detail?: unknown
    me?: string | null
    extra?: Parameters<typeof server.use>
  } = {}
) {
  // Los de `extra` van primero: en MSW gana el primer handler que coincide.
  server.use(
    ...(o.extra ?? []),
    http.get(`${API}/api/v1/me/profile`, () =>
      HttpResponse.json({
        user: {},
        details: {},
        player:
          o.me === null
            ? null
            : {
                id: o.me ?? "otro",
                nick: "x",
                photo_url: null,
                steam_id: null,
              },
        teams: [],
        matches_played: 0,
        preferences: {},
      })
    ),
    http.get(`${API}/api/v1/players/Zeta`, () =>
      HttpResponse.json(o.detail ?? detail())
    ),
    http.get(`${API}/api/v1/players/Zeta/elo-history`, () =>
      HttpResponse.json(
        page([
          {
            match_id: "m2",
            map: "de_nuke",
            at: "2026-10-24T21:00:00Z",
            elo_before: 1035,
            elo_after: 1062,
            elo_delta: 27,
          },
          {
            match_id: "m1",
            map: "de_dust2",
            at: "2026-10-23T21:00:00Z",
            elo_before: 1050,
            elo_after: 1035,
            elo_delta: -15,
          },
        ])
      )
    ),
    http.get(`${API}/api/v1/players/Zeta/matches`, () =>
      HttpResponse.json(page([match]))
    ),
    http.get(`${API}/api/v1/players/Zeta/medals/summary`, () =>
      HttpResponse.json(
        page([
          {
            title: "CAMPEÓN TORNEO TITAN 2",
            icon: "🏆",
            count: 1,
            last_at: "",
          },
        ])
      )
    ),
    http.get(`${API}/api/v1/players/Zeta/elo-adjustments`, () =>
      HttpResponse.json(
        page([
          {
            id: 2,
            kind: "delta",
            delta: 20,
            set_elo: null,
            reason: "Mix caído",
            applied_at: "2026-10-16T02:04:00Z",
          },
        ])
      )
    ),
    http.get(`${API}/api/v1/players/Zeta/teams`, () =>
      HttpResponse.json(
        page([
          {
            team: { id: "t1", name: "Furia Sur", tag: "FUR" },
            role: "player",
            is_captain: true,
            joined_at: "2026-03-10T12:00:00Z",
            left_at: null,
          },
          {
            team: { id: "t9", name: "Nómades", tag: "" },
            role: "sub",
            is_captain: false,
            joined_at: null,
            left_at: "2026-02-01T00:00:00Z",
          },
        ])
      )
    ),
    http.get(`${API}/api/v1/players/Zeta/seasons`, () =>
      HttpResponse.json(page([]))
    ),
    http.get(`${API}/api/v1/players/Zeta/titles`, () =>
      HttpResponse.json(
        page([
          {
            event: { id: "e1", name: "Copa Invierno 2025" },
            result: "champion",
            team: { id: "t1", name: "Furia Sur", tag: "FUR" },
            at: "2025-08-12T00:00:00Z",
          },
        ])
      )
    )
  )
}

function renderProfile(search: PlayerSearch = {}) {
  const onChange = vi.fn()
  const r = renderWithQuery(
    <TooltipProvider>
      <PlayerProfile nick="Zeta" search={search} onChange={onChange} />
    </TooltipProvider>
  )
  return { ...r, onChange }
}

describe("Perfil público", () => {
  it("cabecera, nivel, tiles y resumen de un perfil público", async () => {
    api()
    renderProfile()

    expect(
      await screen.findByRole("heading", { name: "Zeta" })
    ).toBeInTheDocument()
    expect(screen.getByText("Martín Ruiz")).toBeInTheDocument()
    expect(screen.getByText("Verificado")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "+ Brava" })).toBeInTheDocument()
    // El SteamID escrito a mano no se muestra ni da botón de Steam; FACEIT sí.
    expect(screen.queryByText(/STEAM_0/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Steam" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "FACEIT" })).toHaveAttribute(
      "href",
      "https://www.faceit.com/es/players/kyantares"
    )
    expect(screen.getByText("Máximo de la temporada 1078")).toBeInTheDocument()
    expect(
      screen.getByText("Faltan 139 ELO para nivel 6 (1201).")
    ).toBeInTheDocument()
    expect(screen.getByText("10 de 20")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Comparar/ })).toBeInTheDocument()

    expect(await screen.findByText("Mix · de_dust2")).toBeInTheDocument()
    expect(screen.getByText("+27")).toBeInTheDocument()
    expect(
      await screen.findByText("CAMPEÓN TORNEO TITAN 2")
    ).toBeInTheDocument()
    expect(await screen.findByText("Ajustes de ELO")).toBeInTheDocument()
    expect(screen.getByText("Mix caído")).toBeInTheDocument()
    expect(
      await screen.findByRole("img", {
        name: /ELO en los últimos 2 mixes: de 1035 a 1062/,
      })
    ).toBeInTheDocument()
  })

  it("perfil privado visto por otro jugador", async () => {
    api({
      detail: detail({ privacy: "private", private: true, details: null }),
    })
    renderProfile()
    expect(
      await screen.findByText("Perfil privado: nombre, país y redes ocultos")
    ).toBeInTheDocument()
    expect(screen.queryByText("Martín Ruiz")).not.toBeInTheDocument()
    expect(screen.queryByText(/Miembro desde/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "FACEIT" })
    ).not.toBeInTheDocument()
  })

  it("el dueño ve el aviso de privado y Editar perfil", async () => {
    api({ detail: detail({ privacy: "private" }), me: "p1" })
    renderProfile()
    expect(
      await screen.findByText(
        "Perfil privado · solo tú y los admins ven tus datos"
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Editar perfil" })).toHaveAttribute(
      "href",
      "/profile"
    )
    expect(
      screen.queryByRole("link", { name: /Comparar/ })
    ).not.toBeInTheDocument()
  })

  it("ficha sin cuenta: aviso de !claim", async () => {
    api({ detail: detail({ has_account: false, elo: null, level: null }) })
    renderProfile()
    expect(await screen.findByText(/¿Es tu perfil\?/)).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Generar código" })
    ).toHaveAttribute("href", "/profile/link")
    expect(
      screen.getByText("Todavía no jugó mixes en el servidor.")
    ).toBeInTheDocument()
  })

  it("un nick que no existe", async () => {
    api({
      extra: [
        http.get(`${API}/api/v1/players/Zeta`, () =>
          HttpResponse.json(
            { error: { code: "NOT_FOUND", message: "No" } },
            { status: 404 }
          )
        ),
      ],
    })
    renderProfile()
    expect(
      await screen.findByText("No existe un jugador con ese nick.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Ver el ranking" })
    ).toBeInTheDocument()
  })

  it("equipos: líder, período y lo escrito en la web vieja", async () => {
    api()
    renderProfile({ tab: "equipos" })
    expect(await screen.findByText("Activo · líder")).toBeInTheDocument()
    expect(screen.getByText("desde marzo de 2026")).toBeInTheDocument()
    expect(screen.getByText("Suplente")).toBeInTheDocument()
    expect(screen.getAllByText("Actual")).toHaveLength(1)
    expect(screen.getByText("ARVUM · SOVIET")).toBeInTheDocument()
    expect(screen.getByText(/altas y bajas de los rosters/)).toBeInTheDocument()
  })

  it("temporadas vacías y bio con palmarés", async () => {
    api()
    const { unmount } = renderProfile({ tab: "temporadas" })
    expect(
      await screen.findByText("Todavía no terminó ninguna temporada.")
    ).toBeInTheDocument()
    unmount()
    renderProfile({ tab: "bio" })
    expect(
      await screen.findByText("Campeón · Copa Invierno 2025")
    ).toBeInTheDocument()
    expect(screen.getByText("IGL desde 2024.")).toBeInTheDocument()
    expect(screen.getByText("Campeón Liga Apertura 2025")).toBeInTheDocument()
  })

  it("partidas: filtros y clic en una fila", async () => {
    api()
    const { user, onChange } = renderProfile({ tab: "partidas" })
    const table = await screen.findByRole("table")
    const row = await within(table).findByRole("link", {
      name: "Mix · de_dust2",
    })
    await user.click(row)
    expect(navigate).toHaveBeenCalledWith({
      to: "/match/$id",
      params: { id: "m1" },
    })
    await user.click(screen.getByRole("button", { name: "PCW" }))
    expect(onChange).toHaveBeenCalledWith({ kind: "pcw", page: undefined })
    await user.click(screen.getByRole("tab", { name: "Mapas" }))
    expect(onChange).toHaveBeenCalledWith({
      tab: "mapas",
      kind: undefined,
      result: undefined,
      page: undefined,
    })
  })
})
