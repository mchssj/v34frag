import { screen, within } from "@testing-library/react"
import type { AnchorHTMLAttributes, ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { ApiError } from "@/api/errors"
import { TooltipProvider } from "@/components/ui/tooltip"
import { renderWithQuery } from "@/test/render"
import { ReplacePage } from "./ReplacePage"
import { MmSourceContext, type MmSource } from "./source"
import type { MmLobby, MmPlayer, MmReplaceInfo } from "./types"

const navigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
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

const INFO: MmReplaceInfo = {
  status: "open",
  mine: false,
  lobby_id: null,
  mode: "5v5",
  map: "de_dust2",
  team: 1,
  team_name: "team_kyan",
  score: { a: 7, b: 5 },
  rounds_left: 9,
  expires_at: new Date(Date.now() + 600_000).toISOString(),
  reason: null,
}

function setup(
  info: Partial<MmReplaceInfo>,
  take = vi.fn().mockResolvedValue({})
) {
  const replaceInfo = vi.fn().mockResolvedValue({ ...INFO, ...info })
  const source = { replaceInfo, replaceTake: take } as unknown as MmSource
  const r = renderWithQuery(
    <MmSourceContext value={source}>
      <TooltipProvider>
        <ReplacePage token="0123456789abcdef0123456789abcdef" />
      </TooltipProvider>
    </MmSourceContext>
  )
  return { ...r, replaceInfo, take }
}

const card = (id: string, team: 1 | 2, extra: Partial<MmPlayer> = {}) =>
  ({
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
  }) satisfies MmPlayer

// La sala que manda la base en la vista previa: sin el servidor ni lo de quien mira (replanteo 78).
const ROOM = {
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
    card("kyan", 1, { is_captain: true }),
    card("Moe", 1, { abandoned: true }),
    card("Kyle", 2, { is_captain: true }),
  ],
  match_id: "serie-1",
  end_reason: null,
  replacements: [
    {
      team: 1,
      status: "open",
      replaced_player_id: "Moe",
      replaced_nick: "Moe",
      by_player_id: null,
      by_nick: null,
      left_round: 14,
      joined_round: null,
      connect_deadline: null,
    },
  ],
} as unknown as MmLobby

describe("ReplacePage", () => {
  it("con la sala: la vista previa con el lugar libre, sin el servidor, y lo toma", async () => {
    const { user, take } = setup({
      room: ROOM,
      replaced_nick: "Moe",
      left_round: 14,
    })
    expect(
      await screen.findByText("Se busca reemplazo · vista previa")
    ).toBeInTheDocument()
    const team = screen.getByRole("region", { name: "Equipo A" })
    expect(within(team).getByText("Aquí entrarías tú")).toBeInTheDocument()
    expect(
      screen.getByText(/Moe abandonó y team_kyan quedó con uno menos/)
    ).toBeInTheDocument()
    expect(
      screen.getByText("La IP y la contraseña aparecen cuando tomas el lugar.")
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: /Entrar como reemplazo/ })
    )
    expect(take).toHaveBeenCalledWith("0123456789abcdef0123456789abcdef")
  })

  it("muestra la partida y lo toma", async () => {
    const { user, take } = setup({})
    expect(await screen.findByText("5v5 · de_dust2 · 7-5")).toBeInTheDocument()
    expect(screen.getByText("team_kyan")).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: /Entrar como reemplazo/ })
    )
    expect(take).toHaveBeenCalledWith("0123456789abcdef0123456789abcdef")
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: "/play" })
    )
  })

  it("si no puede entrar, dice por qué y no muestra el botón", async () => {
    setup({ reason: "Tenés una sanción vigente" })
    expect(
      await screen.findByText("No puedes entrar: Tenés una sanción vigente.")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Entrar como reemplazo/ })
    ).toBeNull()
  })

  it("tomado por otro o vencido", async () => {
    setup({ status: "taken" })
    expect(
      await screen.findByText("Ya lo tomó otro jugador.")
    ).toBeInTheDocument()
  })

  it("si otro llegó primero, vuelve a pedir la info", async () => {
    const take = vi.fn().mockRejectedValue(
      new ApiError({
        status: 409,
        code: "CONFLICT",
        message: "Ya lo tomó otro jugador",
      })
    )
    const { user, replaceInfo } = setup({}, take)
    await user.click(
      await screen.findByRole("button", { name: /Entrar como reemplazo/ })
    )
    await vi.waitFor(() => expect(replaceInfo).toHaveBeenCalledTimes(2))
  })

  it("si ya lo tomé, lleva a la sala", async () => {
    const { user } = setup({ status: "taken", mine: true, lobby_id: "l1" })
    await user.click(
      await screen.findByRole("button", { name: "Ir a la sala" })
    )
    expect(navigate).toHaveBeenCalledWith({ to: "/play" })
  })
})
