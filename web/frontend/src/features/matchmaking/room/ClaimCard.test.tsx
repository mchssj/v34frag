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
import type { MmLobby, MmPlayer } from "../types"
import { ClaimCard, needsClaim } from "./ClaimCard"

const API = "http://api.test"
const later = (ms: number) => new Date(Date.now() + ms).toISOString()

const created = vi.fn()
const server = setupServer(
  http.post(`${API}/api/v1/me/claim-code`, () => {
    created()
    return HttpResponse.json({ code: "NEW789", expires_at: later(600_000) })
  })
)
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  created.mockReset()
})
afterAll(() => server.close())

function statusWith(lastCode: { code: string; expires_at: string } | null) {
  server.use(
    http.get(`${API}/api/v1/me/claim-code`, () =>
      HttpResponse.json({
        steam_ids: [],
        max_steam_ids: 4,
        last_code: lastCode && { ...lastCode, status: "pending", result: null },
        pending_requests: 0,
      })
    )
  )
}

const lobbyWith = (status: MmLobby["status"], me: Partial<MmPlayer>): MmLobby =>
  ({
    status,
    players: [
      { is_me: true, ...me },
      { is_me: false, linked: false },
    ],
  }) as MmLobby

describe("needsClaim", () => {
  it("solo para quien mira, sin vincular y antes de que arranque", () => {
    expect(needsClaim(lobbyWith("connecting", { linked: false }))).toBe(true)
    expect(needsClaim(lobbyWith("veto", { linked: false }))).toBe(true)
    expect(needsClaim(lobbyWith("accepting", { linked: false }))).toBe(false)
    expect(needsClaim(lobbyWith("live", { linked: false }))).toBe(false)
    expect(needsClaim(lobbyWith("connecting", { linked: true }))).toBe(false)
  })

  it("sin el campo (API vieja o demo) se toma como vinculado", () => {
    expect(needsClaim(lobbyWith("connecting", {}))).toBe(false)
  })
})

describe("ClaimCard", () => {
  it("sin código vigente, pide uno y muestra el comando", async () => {
    statusWith(null)
    renderWithQuery(<ClaimCard />)
    expect(await screen.findByText("!claim NEW789")).toBeInTheDocument()
    expect(created).toHaveBeenCalledTimes(1)
  })

  it("con un código vigente, lo reutiliza sin pedir otro", async () => {
    statusWith({ code: "OLD123", expires_at: later(300_000) })
    renderWithQuery(<ClaimCard />)
    expect(await screen.findByText("!claim OLD123")).toBeInTheDocument()
    expect(created).not.toHaveBeenCalled()
  })

  it("si el código venció, deja pedir otro", async () => {
    statusWith({ code: "OLD123", expires_at: later(1500) })
    const { user } = renderWithQuery(<ClaimCard />)
    await screen.findByText("!claim OLD123")
    const again = await screen.findByRole(
      "button",
      { name: "Generar otro código" },
      { timeout: 4000 }
    )
    expect(created).not.toHaveBeenCalled()
    await user.click(again)
    expect(await screen.findByText("!claim NEW789")).toBeInTheDocument()
  })
})
