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
import { AddSteamDialog } from "./FichasTab"
import type { PlayerDetail } from "../types"

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ME = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const S64 = "76561199234381130"
const p = { id: ME, alias: "gttt.", steam_ids: [] } as unknown as PlayerDetail

const owner = (player_id: string | null) =>
  http.get(`${API}/api/v1/players/steam/${S64}`, () =>
    HttpResponse.json({
      steam_id: S64,
      claimed: !!player_id,
      player_id,
      profile: null,
      ban: null,
    })
  )

function open(onOpen = vi.fn()) {
  const r = renderWithQuery(
    <AddSteamDialog p={p} onClose={vi.fn()} onOpen={onOpen} />
  )
  return { ...r, onOpen }
}

describe("Agregar SteamID", () => {
  it("avisa si es de otra ficha y lleva a ella", async () => {
    server.use(
      owner(OTHER),
      http.get(`${API}/api/v1/players/${OTHER}`, () =>
        HttpResponse.json({ id: OTHER, alias: "hyd @ it's gtt." })
      )
    )
    const { user, onOpen } = open()
    await user.type(screen.getByLabelText("SteamID"), "STEAM_0:0:637057701")
    expect(await screen.findByText("hyd @ it's gtt.")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Agregar SteamID" })
    ).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Abrir esa ficha" }))
    expect(onOpen).toHaveBeenCalledWith(OTHER)
  })

  it("agrega uno que no es de nadie (404)", async () => {
    let body: unknown
    server.use(
      http.get(`${API}/api/v1/players/steam/${S64}`, () =>
        HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "No" } },
          { status: 404 }
        )
      ),
      http.post(`${API}/api/v1/admin/steam/link`, async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      })
    )
    const { user } = open()
    await user.type(
      screen.getByLabelText("SteamID"),
      `https://steamcommunity.com/profiles/${S64}`
    )
    const add = screen.getByRole("button", { name: "Agregar SteamID" })
    await vi.waitFor(() => expect(add).toBeEnabled())
    await user.click(add)
    await vi.waitFor(() =>
      expect(body).toEqual({ steam_id: S64, player_id: ME })
    )
  })

  it("dice si ya es de esta ficha", async () => {
    server.use(owner(ME))
    const { user } = open()
    await user.type(screen.getByLabelText("SteamID"), S64)
    expect(
      await screen.findByText("Ese SteamID ya es de esta ficha.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Agregar SteamID" })
    ).toBeDisabled()
  })
})
