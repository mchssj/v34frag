import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ApiError } from "@/api/errors"
import { renderWithQuery } from "@/test/render"
import { ReplacePage } from "./ReplacePage"
import { MmSourceContext, type MmSource } from "./source"
import type { MmReplaceInfo } from "./types"

const navigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }))

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
      <ReplacePage token="0123456789abcdef0123456789abcdef" />
    </MmSourceContext>
  )
  return { ...r, replaceInfo, take }
}

describe("ReplacePage", () => {
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
    const take = vi
      .fn()
      .mockRejectedValue(
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
