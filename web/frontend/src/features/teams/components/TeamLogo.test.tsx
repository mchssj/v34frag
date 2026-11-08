import { screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { renderWithQuery } from "@/test/render"
import type { TeamDetail } from "../types"
import { EditTeamSheet } from "./TeamLogo"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const API = "http://api.test"
const ID = "44444444-4444-4444-8444-444444444444"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Solo lo que usa el panel.
const team = (p: Partial<TeamDetail>): TeamDetail =>
  ({
    id: ID,
    name: "Los Pibes",
    tag: "LP",
    logo_url: null,
    next_name_change_at: null,
    viewer: { is_admin: false },
    ...p,
  }) as unknown as TeamDetail

describe("EditTeamSheet: nombre y sigla", () => {
  it("con la espera corriendo, los campos están apagados y dice desde cuándo", () => {
    renderWithQuery(
      <EditTeamSheet
        team={team({ next_name_change_at: "2026-12-05T15:00:00Z" })}
        open
        onOpenChange={() => {}}
      />
    )
    expect(screen.getByRole("textbox", { name: "Nombre" })).toBeDisabled()
    expect(screen.getByText(/5 de diciembre/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Guardar nombre" })).toBeNull()
  })

  it("sin espera, Guardar nombre manda el nombre y la sigla", async () => {
    const sent = vi.fn()
    server.use(
      http.patch(`${API}/api/v1/teams/${ID}`, async ({ request }) => {
        sent(await request.json())
        return HttpResponse.json({})
      })
    )
    const { user } = renderWithQuery(
      <EditTeamSheet team={team({})} open onOpenChange={() => {}} />
    )
    const save = screen.getByRole("button", { name: "Guardar nombre" })
    expect(save).toBeDisabled()
    const name = screen.getByRole("textbox", { name: "Nombre" })
    await user.clear(name)
    await user.type(name, "Los Pibes 2")
    await user.clear(screen.getByRole("textbox", { name: "Sigla" }))
    await user.type(screen.getByRole("textbox", { name: "Sigla" }), "lp 2")
    await user.click(save)
    await vi.waitFor(() =>
      expect(sent).toHaveBeenCalledWith({ name: "Los Pibes 2", tag: "LP2" })
    )
  })
})
