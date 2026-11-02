import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { renderWithQuery } from "@/test/render"
import type { SeriesDetail } from "../lib/series"
import { booking } from "../lib/booking.fixture"
import type { MatchBooking } from "../types/booking"
import { ServerPanel } from "./ServerPanel"

const API = "http://api.test"
const T1 = "11111111-1111-4111-8111-111111111111"
const T2 = "22222222-2222-4222-8222-222222222222"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const names: [string, string] = ["Alfa", "Beta"]
const d = (over: Record<string, unknown> = {}) =>
  ({
    id: "m1",
    kind: "official",
    status: "upcoming",
    best_of: 1,
    side1: {
      name: "Alfa",
      team: { id: T1, name: "Alfa", tag: "AL" },
      score: 0,
    },
    side2: {
      name: "Beta",
      team: { id: T2, name: "Beta", tag: "BE" },
      score: 0,
    },
    veto: {
      pool: [
        { name: "de_dust2", versions: ["de_dust2"] },
        { name: "de_inferno", versions: ["de_inferno", "de_inferno_classic"] },
        { name: "de_nuke", versions: ["de_nuke"] },
      ],
      actions: [],
      sequence: ["ban", "ban"],
      next: { team_id: T1, action: "ban" },
      maps_to_play: [],
    },
    ...over,
  }) as unknown as SeriesDetail

const mb = (over: Partial<MatchBooking> = {}): MatchBooking => ({
  kind: "official",
  veto_done: false,
  can_veto: false,
  veto_turn_seconds: 30,
  maps: [],
  my_side: 0,
  can_manage: false,
  can_start: false,
  can_ready: false,
  ban_until: null,
  booking: null,
  ...over,
})

const serve = (data: MatchBooking) =>
  server.use(
    http.get(`${API}/api/v1/matches/m1/booking`, () => HttpResponse.json(data))
  )

describe("ServerPanel", () => {
  it("no muestra nada a quien no tiene nada que hacer", async () => {
    serve(mb())
    const { container } = renderWithQuery(<ServerPanel d={d()} names={names} />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it("el organizador inicia en un servidor libre con la espera elegida", async () => {
    serve(mb({ can_start: true, can_manage: true }))
    let sent: unknown = null
    server.use(
      http.get(`${API}/api/v1/servers/free`, () =>
        HttpResponse.json({
          items: [{ id: "s1", name: "CMLeague #1", region: "Sudamerica" }],
          total: 1,
        })
      ),
      http.post(`${API}/api/v1/matches/m1/start`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(
          mb({ booking: booking({ status: "veto", map: null }) })
        )
      })
    )
    const { user } = renderWithQuery(<ServerPanel d={d()} names={names} />)
    await user.click(
      await screen.findByRole("button", { name: "Iniciar la partida" })
    )
    const iniciar = screen.getByRole("button", { name: "Iniciar" })
    expect(iniciar).toBeDisabled()
    await user.click(await screen.findByRole("radio"))
    await user.click(iniciar)
    await waitFor(() =>
      expect(sent).toEqual({ server_id: "s1", wait_minutes: 10 })
    )
  })

  it("sin servidores libres lo dice y no deja iniciar", async () => {
    serve(mb({ can_start: true, can_manage: true }))
    server.use(
      http.get(`${API}/api/v1/servers/free`, () =>
        HttpResponse.json({ items: [], total: 0 })
      )
    )
    const { user } = renderWithQuery(<ServerPanel d={d()} names={names} />)
    await user.click(
      await screen.findByRole("button", { name: "Iniciar la partida" })
    )
    expect(
      await screen.findByText(/No hay servidores libres/)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Iniciar" })).toBeDisabled()
  })

  it("veto con reloj: el capitán del turno banea", async () => {
    const deadline = new Date(Date.now() + 25_000).toISOString()
    serve(
      mb({
        can_veto: true,
        booking: booking({
          status: "veto",
          map: null,
          veto_deadline: deadline,
        }),
      })
    )
    let sent: unknown = null
    server.use(
      http.post(`${API}/api/v1/matches/m1/veto`, async ({ request }) => {
        sent = await request.json()
        return new HttpResponse(null, { status: 204 })
      })
    )
    const { user } = renderWithQuery(<ServerPanel d={d()} names={names} />)
    expect(
      await screen.findByText(/se elige un mapa al azar/)
    ).toBeInTheDocument()
    expect(screen.getByText(/0:2\d/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Banear de_nuke" }))
    await waitFor(() => expect(sent).toEqual({ map: "de_nuke" }))
  })

  it("la conexión y la espera para el plantel", async () => {
    serve(
      mb({
        my_side: 1,
        veto_done: true,
        booking: booking({
          wait_deadline: new Date(Date.now() + 300_000).toISOString(),
          side_n1: 5,
          side_ok1: true,
          side_n2: 3,
          side_ok2: false,
          connection: {
            address: "1.2.3.4:27015",
            password: "abc123",
            url: "steam://connect/1.2.3.4:27015/abc123",
          },
        }),
      })
    )
    renderWithQuery(<ServerPanel d={d({ veto: null })} names={names} />)
    expect(await screen.findByText("1.2.3.4:27015")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Conectarse" })).toHaveAttribute(
      "href",
      "steam://connect/1.2.3.4:27015/abc123"
    )
    expect(screen.getByText("Beta: 3 en su lado")).toBeInTheDocument()
    expect(screen.getByText(/Espera a los equipos/)).toBeInTheDocument()
  })

  it("el organizador deja empezar con 4 cuando vence la espera", async () => {
    serve(
      mb({
        can_manage: true,
        veto_done: true,
        booking: booking({
          wait_expired: true,
          wait_started_at: new Date(Date.now() - 12 * 60_000).toISOString(),
          wait_deadline: new Date(Date.now() - 2 * 60_000).toISOString(),
        }),
      })
    )
    let sent: unknown = null
    server.use(
      http.post(
        `${API}/api/v1/matches/m1/booking/actions`,
        async ({ request }) => {
          sent = await request.json()
          return HttpResponse.json(mb())
        }
      )
    )
    const { user } = renderWithQuery(
      <ServerPanel d={d({ veto: null })} names={names} />
    )
    expect(await screen.findByText(/Para dar W.O./)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Esperar 5 min más" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Beta con 4" }))
    await waitFor(() => expect(sent).toEqual({ action: "allow_four", side: 2 }))
  })

  it("PCW: el equipo se marca listo y ve la sanción del abandono", async () => {
    let state = mb({ kind: "pcw", my_side: 2, can_ready: true })
    let hit = false
    server.use(
      http.get(`${API}/api/v1/matches/m1/booking`, () =>
        HttpResponse.json(state)
      ),
      http.post(`${API}/api/v1/matches/m1/ready`, () => {
        hit = true
        state = mb({
          kind: "pcw",
          my_side: 2,
          can_ready: true,
          booking: booking({
            kind: "pcw",
            status: "ready",
            ready1: false,
            ready2: true,
          }),
        })
        return HttpResponse.json(state)
      })
    )
    const { user } = renderWithQuery(
      <ServerPanel d={d({ kind: "pcw" })} names={names} />
    )
    expect(
      await screen.findByText(/no puede jugar PCW por 3 días/)
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Estamos listos" }))
    await waitFor(() => expect(hit).toBe(true))
    expect(
      await screen.findByText("Falta que Alfa se marque listo.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Ya no estamos listos" })
    ).toBeInTheDocument()
  })

  it("PCW abandonada: explica quién y que no cuenta", async () => {
    serve(
      mb({
        kind: "pcw",
        booking: booking({
          kind: "pcw",
          status: "abandoned",
          abandoned_side: 1,
        }),
      })
    )
    renderWithQuery(
      <ServerPanel d={d({ kind: "pcw", status: "cancelled" })} names={names} />
    )
    expect(
      await screen.findByText(/Alfa no se presentó o abandonó/)
    ).toBeInTheDocument()
  })
})
