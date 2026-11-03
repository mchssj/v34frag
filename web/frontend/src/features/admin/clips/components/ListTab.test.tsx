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

import { renderWithQuery } from "@/test/render"
import type { AdminClip } from "../types"
import { ListTab } from "./ListTab"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// El link a la partida no necesita el router en esta prueba.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}))

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const clip = (
  id: string,
  nick: string,
  status: AdminClip["clip"]["video"]["status"],
  blocked: string | null
): AdminClip => ({
  clip: {
    id,
    position: 1,
    type: "ace",
    priority: 1,
    round: 7,
    round_seconds: 12,
    round_won: true,
    player: null,
    game_nick: nick,
    steam_id: null,
    kills: 5,
    kill_ticks: [],
    clutch_vs: null,
    clutch_start_tick: null,
    end_tick: null,
    tickrate: 100,
    demo_seconds: 10,
    video: { status, url: null, embed_url: null, seconds: null },
    vip: false,
    review: null,
  },
  match: {
    id: "00000000-0000-4000-8000-000000000000",
    map: "de_dust2",
    played_at: null,
  },
  reprocess_count: 0,
  discord_posted: false,
  can_reprocess: blocked === null,
  blocked_reason: blocked,
})

const ID_A = "11111111-1111-4111-8111-111111111111"
const ID_B = "22222222-2222-4222-8222-222222222222"
const ID_C = "33333333-3333-4333-8333-333333333333"
const ITEMS = [
  clip(ID_A, "alfa", "failed", null),
  clip(ID_B, "bravo", "done", null),
  clip(
    ID_C,
    "charlie",
    "unavailable",
    "La demo ya no está: no se puede volver a grabar"
  ),
]

function list() {
  return http.get(`${API}/api/v1/admin/clips`, () =>
    HttpResponse.json({ items: ITEMS, total: ITEMS.length, page: 1, per: 25 })
  )
}

describe("ListTab", () => {
  it("apaga la casilla de los que no se pueden reprocesar y elegir la página toma solo los demás", async () => {
    server.use(list())
    const { user } = renderWithQuery(<ListTab />)
    const blocked = await screen.findByRole("checkbox", {
      name: /Elegir el clip de charlie/,
    })
    expect(blocked).toBeDisabled()
    await user.click(
      screen.getByRole("checkbox", { name: "Elegir todos los de esta página" })
    )
    const bar = screen.getByRole("region", { name: "Clips elegidos" })
    expect(within(bar).getByText("2 clips elegidos")).toBeInTheDocument()
  })

  it("Reprocesar manda los elegidos y avisa cuál no se pudo, que queda elegido", async () => {
    const sent = vi.fn()
    server.use(
      list(),
      http.post(`${API}/api/v1/admin/clips/reprocess`, async ({ request }) => {
        const body = (await request.json()) as { ids: string[] }
        sent(body.ids)
        return HttpResponse.json({
          results: [
            { id: ID_A, ok: true, error: null },
            { id: ID_B, ok: false, error: "Se está grabando ahora" },
          ],
        })
      })
    )
    const { user } = renderWithQuery(<ListTab />)
    await user.click(
      await screen.findByRole("checkbox", { name: /Elegir el clip de alfa/ })
    )
    await user.click(
      screen.getByRole("checkbox", { name: /Elegir el clip de bravo/ })
    )
    await user.click(screen.getByRole("button", { name: "Reprocesar" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Reprocesar" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("No se pudieron reprocesar")
    expect(alert).toHaveTextContent("bravo")
    expect(alert).toHaveTextContent("Se está grabando ahora")
    expect(sent).toHaveBeenCalledWith([ID_A, ID_B])
    expect(screen.getByText("1 clip elegido")).toBeInTheDocument()
  })
})
