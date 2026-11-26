import { screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { API, server, setupApi } from "@/features/ranking/test/fixtures"
import { renderWithQuery } from "@/test/render"
import { EloPage } from "./EloPage"

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock("@/components/brand/BackButton", () => ({ BackButton: () => null }))

setupApi()

const config = {
  base: 20,
  mult_win_min: 0.75,
  mult_win_max: 1.5,
  mult_loss_min: 0.5,
  mult_loss_max: 1.25,
  team_cap: 30,
  min_delta: 10,
  elo_floor: 100,
  min_pct: 35,
  full_pct: 90,
}
const steps = {
  abandoned: false,
  counted_as: "win",
  win_prob: 0.5,
  base: 20,
  rating: 1.4,
  mult: 1.4,
  rounds: 24,
  total_rounds: 24,
  weight: 1,
  raw: 28,
  adjusted: 28,
  scale: 1,
  scaled: 28,
  min: 10,
  after_min: 28,
  floor_hit: false,
  exact: true,
}
const mix = (id: string, o: Record<string, unknown> = {}) => ({
  match_id: id,
  map: id,
  at: "2026-11-20T20:00:00Z",
  own_score: 13,
  other_score: 8,
  result: "win",
  elo_before: 1000,
  elo_after: 1028,
  elo_delta: 28,
  formula: "match",
  steps,
  ...o,
})
const answer = (o: Record<string, unknown>) =>
  server.use(
    http.get(`${API}/api/v1/me/elo/breakdown`, () =>
      HttpResponse.json({ page: 1, per: 12, total: 1, ...o })
    )
  )

describe("Desglose de ELO", () => {
  it("con VIP: los pasos del mix elegido y el simulador", async () => {
    answer({
      vip: true,
      config,
      total: 3,
      items: [
        mix("season"),
        mix("cache", { formula: "old", steps: null }),
        mix("tuscan", { steps: { ...steps, exact: false } }),
      ],
    })
    const { user } = renderWithQuery(<EloPage page={1} onPage={vi.fn()} />)
    expect(
      await screen.findByText("Multiplicador por tu rating")
    ).toBeInTheDocument()
    expect(screen.getByText("× 1,4")).toBeInTheDocument()
    expect(screen.getByText("Simulador")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /cache/ }))
    expect(screen.getByText(/otra fórmula/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /tuscan/ }))
    expect(
      screen.getByText(/La configuración del ELO cambió/)
    ).toBeInTheDocument()
  })

  it("sin VIP: el cambio y cómo ser VIP, sin simulador", async () => {
    answer({
      vip: false,
      config: null,
      items: [mix("season", { steps: null })],
    })
    renderWithQuery(<EloPage page={1} onPage={vi.fn()} />)
    expect(await screen.findByText("+28")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ser VIP" })).toBeInTheDocument()
    expect(screen.queryByText("Simulador")).not.toBeInTheDocument()
  })

  it("sin mixes", async () => {
    answer({ vip: false, config: null, total: 0, items: [] })
    renderWithQuery(<EloPage page={1} onPage={vi.fn()} />)
    expect(
      await screen.findByText("Todavía no tienes mixes con ELO")
    ).toBeInTheDocument()
  })
})
