import { screen, within } from "@testing-library/react"
import type { AnchorHTMLAttributes, ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import type { RoomPlayer } from "@/features/mixes/lib/room"
import { renderWithQuery } from "@/test/render"
import type { MmLobby, MmPlayer, MmReplacement } from "../types"
import { MmSourceContext, type MmSource } from "../source"
import { RoomOverview, type RoomMode } from "./RoomOverview"

// Sin router en la prueba: el nick y "Mi perfil" son Link.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: { to: string; children: ReactNode } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "href"
  >) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

const player = (
  id: string,
  team: 1 | 2,
  extra: Partial<MmPlayer> = {}
): MmPlayer => ({
  player_id: id,
  nick: id,
  level: 5,
  elo: 1000,
  team,
  party_id: null,
  is_captain: false,
  accepted: true,
  connected: true,
  left_until: null,
  abandoned: false,
  is_me: false,
  photo_url: null,
  country: null,
  anticheat: false,
  form: [],
  fav_map: null,
  meetings: { with: [], against: [] },
  elo_trend: null,
  recent: null,
  ...extra,
})

const stat = (key: string, rounds: number, delta: number): RoomPlayer => ({
  key,
  nick: key,
  alias: key,
  guest: false,
  mvp: false,
  me: false,
  k: 10,
  d: 8,
  a: 2,
  hs: 40,
  hsKills: 4,
  adr: 80.5,
  rounds,
  k2: 0,
  k3: 0,
  k4: 0,
  k5: 0,
  fk: 0,
  fd: 0,
  plants: 0,
  defuses: 0,
  clutches: null,
  rating: 1.05,
  delta,
})

const rep = (extra: Partial<MmReplacement>): MmReplacement => ({
  team: 1,
  status: "open",
  replaced_player_id: "Moe",
  replaced_nick: "Moe",
  by_player_id: null,
  by_nick: null,
  left_round: 14,
  joined_round: null,
  connect_deadline: null,
  ...extra,
})

const lobby = (extra: Partial<MmLobby>): MmLobby => ({
  id: "lobby-1",
  mode: "5v5",
  region: null,
  match: null,
  status: "live",
  map: "de_dust2",
  accept_deadline: null,
  veto: null,
  connect_deadline: null,
  players: [
    player("Arnold", 1, { is_captain: true, elo: 1200 }),
    player("Moe", 1, { abandoned: true, elo: 1100 }),
    player("Kyle", 2, { is_captain: true }),
  ],
  server: null,
  match_id: null,
  end_reason: null,
  reported: [],
  commended: null,
  elo_stake: null,
  replacements: [],
  ...extra,
})

const render = (l: MmLobby, mode: RoomMode, takeCard?: ReactNode) =>
  renderWithQuery(
    <MmSourceContext value={{} as MmSource}>
      <TooltipProvider>
        <RoomOverview lobby={l} map={null} mode={mode} takeCard={takeCard} />
      </TooltipProvider>
    </MmSourceContext>
  )

describe("RoomOverview con reemplazos (replanteo 78)", () => {
  it("vista previa del link: el lugar libre, el botón y el servidor con candado", () => {
    render(
      lobby({ replacements: [rep({})] }),
      "preview",
      <button>Entrar como reemplazo</button>
    )
    const team = screen.getByRole("region", { name: "Equipo A" })
    expect(within(team).getByText("Aquí entrarías tú")).toBeInTheDocument()
    expect(within(team).getByText("Tu equipo si entras")).toBeInTheDocument()
    // El que se fue deja su lugar: no aparece como fila.
    expect(within(team).queryByRole("link", { name: "Moe" })).toBeNull()
    expect(
      screen.getByRole("button", { name: "Entrar como reemplazo" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("La IP y la contraseña aparecen cuando tomas el lugar.")
    ).toBeInTheDocument()
    expect(screen.queryByText("Contraseña")).toBeNull()
    expect(screen.queryByText("Cambios en la partida")).toBeNull()
  })

  it("tomé el lugar: la cuenta regresiva, mi fila en su lugar y el que se fue al final", () => {
    const l = lobby({
      players: [
        player("Arnold", 1, { is_captain: true, elo: 1200 }),
        player("Moe", 1, { abandoned: true, elo: 1100 }),
        player("Albert", 1, { is_me: true, connected: false, elo: 900 }),
        player("Kyle", 2, { is_captain: true }),
      ],
      replacements: [
        rep({
          status: "taken",
          by_player_id: "Albert",
          by_nick: "Albert",
          connect_deadline: new Date(Date.now() + 150_000).toISOString(),
        }),
      ],
    })
    render(l, "live")
    expect(screen.getByText("Entra al servidor")).toBeInTheDocument()
    expect(screen.getByRole("timer")).toHaveTextContent(
      /Quedan 2:\d\d para entrar/
    )
    const team = screen.getByRole("region", { name: "Equipo A" })
    const rows = within(team).getAllByRole("listitem")
    // Arnold, yo (en el lugar de Moe, aunque tengo menos ELO) y Moe tachado al final.
    expect(rows[1]).toHaveTextContent("Albert")
    expect(rows[1]).toHaveTextContent("Reemplazo")
    expect(rows[1]).toHaveTextContent(
      "Reemplaza a Moe · todavía no entró al servidor"
    )
    expect(rows.at(-1)).toHaveTextContent("Abandonó en la ronda 14")
    expect(screen.getByText("Cambios en la partida")).toBeInTheDocument()
  })

  it("detalle de la partida: los números de esa partida, el ELO y sin chat ni reportes", () => {
    const l = lobby({
      status: "finished",
      match_id: "serie-1",
      players: [
        player("Arnold", 1, { is_captain: true, elo: 1200 }),
        player("Moe", 1, { abandoned: true, replaced: true }),
        player("Albert", 1, { replacement: true }),
        player("Kyle", 2, { is_captain: true }),
      ],
      replacements: [
        rep({
          status: "connected",
          by_player_id: "Albert",
          by_nick: "Albert",
          joined_round: 17,
        }),
      ],
      match: {
        score1: 16,
        score2: 12,
        halves: null,
        rounds: 28,
        winner: 1,
        played_at: new Date().toISOString(),
        demo_url: null,
        clips: [],
        stats: [
          stat("Arnold", 28, 25),
          stat("Albert", 12, 18),
          stat("Moe", 14, -4),
          stat("Kyle", 28, -25),
        ],
      },
    })
    render(l, "detail")
    const team = screen.getByRole("region", { name: "Equipo A" })
    expect(within(team).getByText("Esta partida")).toBeInTheDocument()
    expect(
      within(team).getByText("Entró en la ronda 17 en lugar de Moe")
    ).toBeInTheDocument()
    expect(within(team).getAllByText("Rondas")).toHaveLength(2)
    expect(within(team).getByText("+18")).toBeInTheDocument()
    expect(within(team).getByText("-4")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Reportar/ })).toBeNull()
    expect(screen.queryByText("Volver a Jugar")).toBeNull()
    expect(screen.getByText("Albert entró de reemplazo")).toBeInTheDocument()
  })
})
