import { screen, within } from "@testing-library/react"
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

import type { Schemas } from "@/api/client"
import { renderWithQuery } from "@/test/render"
import { ClipsSection } from "./ClipsSection"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}))

const API = "http://api.test"
const MATCH = "88888888-8888-4888-8888-888888888888"
const ids = ["a", "b", "c", "d"].map(
  (x) => `${x.repeat(8)}-1111-4111-8111-111111111111`
)
const item = (id: string, type: Schemas["Clip"]["type"], map: string) => ({
  clip: {
    id,
    position: 1,
    type,
    priority: 1,
    round: 9,
    round_seconds: 10,
    round_won: true,
    player: null,
    game_nick: "kyan",
    steam_id: null,
    kills: 5,
    kill_ticks: [],
    clutch_vs: null,
    clutch_start_tick: null,
    end_tick: null,
    tickrate: 66,
    demo_seconds: 1,
    video: { status: "done" as const, url: null, embed_url: null, seconds: 20 },
    vip: false,
    review: null,
  },
  match: { id: MATCH, map, played_at: "2026-11-02T20:00:00Z" },
})
const DATA: Schemas["MyClips"] = {
  mode: "auto",
  vip: false,
  max: 3,
  max_vip: 10,
  picked: [],
  shown: [ids[0]!, ids[2]!],
  clips: [
    item(ids[0]!, "ace", "de_dust2"),
    item(ids[1]!, "3k", "de_nuke"),
    item(ids[2]!, "4k", "de_train"),
    item(ids[3]!, "3k", "de_aztec"),
  ],
}

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function serve(data: Schemas["MyClips"], onPut?: (body: unknown) => void) {
  server.use(
    http.get(`${API}/api/v1/me/clips`, () => HttpResponse.json(data)),
    http.get(`${API}/api/v1/maps`, () =>
      HttpResponse.json({ items: [], total: 0, page: 1, per: 100 })
    ),
    http.get(`${API}/api/v1/me/profile`, () =>
      HttpResponse.json({ player: { nick: "kyan" } })
    ),
    http.put(`${API}/api/v1/me/clips/featured`, async ({ request }) => {
      const body = (await request.json()) as {
        mode: "auto" | "manual"
        ids: string[]
      }
      onPut?.(body)
      return HttpResponse.json({
        ...data,
        mode: body.mode,
        picked: body.ids,
        shown: body.ids,
      })
    })
  )
}

describe("Mi Perfil › Clips", () => {
  it("en automático muestra los que se eligen solos y no deja marcar", async () => {
    serve(DATA)
    renderWithQuery(<ClipsSection />)
    expect(await screen.findByText("2 de 3")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Automático/ })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    const list = screen.getByRole("region", {
      name: "Tus destacados, en orden",
    })
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((li) => li.textContent)
    ).toEqual([
      expect.stringContaining("ACE en de_dust2"),
      expect.stringContaining("4K en de_train"),
    ])
    expect(
      screen.getByRole("button", { name: "Destacar 3K en de_nuke" })
    ).toBeDisabled()
    expect(screen.getByText("Con VIP destacas hasta 10.")).toBeInTheDocument()
  })

  it("con Elijo yo marca, ordena y guarda; al llegar al tope no deja marcar otro", async () => {
    const put = vi.fn()
    serve(DATA, put)
    const { user } = renderWithQuery(<ClipsSection />)
    await user.click(await screen.findByRole("radio", { name: /Elijo yo/ }))
    await user.click(
      screen.getByRole("button", { name: "Destacar 3K en de_nuke" })
    )
    await user.click(
      screen.getByRole("button", { name: "Destacar ACE en de_dust2" })
    )
    await user.click(
      screen.getByRole("button", { name: "Subir ACE en de_dust2" })
    )
    await user.click(
      screen.getByRole("button", { name: "Destacar 4K en de_train" })
    )
    expect(screen.getByText("3 de 3")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Destacar 3K en de_aztec" })
    ).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Guardar" }))
    await vi.waitFor(() =>
      expect(put).toHaveBeenCalledWith({
        mode: "manual",
        ids: [ids[0], ids[1], ids[2]],
      })
    )
  })

  it("sin clips con video lo dice", async () => {
    serve({ ...DATA, shown: [], clips: [] })
    renderWithQuery(<ClipsSection />)
    expect(
      await screen.findByText(/Todavía no tienes clips con video/)
    ).toBeInTheDocument()
  })
})
