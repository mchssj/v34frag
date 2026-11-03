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
import type { Room, RoomPlayer } from "../lib/room"
import { mixHighlights } from "./MixHighlights"

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}))

const API = "http://api.test"
const MVP = "https://x.test/photos/mm/1.webp"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const player = (o: Partial<RoomPlayer>): RoomPlayer => ({
  key: o.nick ?? "x",
  nick: "x",
  alias: null,
  guest: false,
  mvp: false,
  me: false,
  k: 0,
  d: 0,
  a: 0,
  hs: null,
  hsKills: 0,
  adr: null,
  rounds: 20,
  k2: 0,
  k3: 0,
  k4: 0,
  k5: 0,
  fk: 0,
  fd: 0,
  plants: 0,
  defuses: 0,
  clutches: [0, 0, 0, 0, 0],
  rating: null,
  delta: null,
  ...o,
})

const room = {
  status: "finished",
  side1: {
    players: [
      player({ nick: "kyan", k: 25, rating: 1.6, mvp: true, adr: 110 }),
    ],
  },
  side2: {
    players: [player({ nick: "daniloev", k: 12, rating: 0.8, adr: 60 })],
  },
} as unknown as Room

function api(opts: { image?: string | null; clips?: unknown[] }) {
  server.use(
    http.get(`${API}/api/v1/mm/mvp-image`, () =>
      HttpResponse.json({ url: opts.image ?? null })
    ),
    http.get(`${API}/api/v1/matches/m1/clips`, () =>
      HttpResponse.json({ items: opts.clips ?? [], total: 0, page: 1, per: 50 })
    )
  )
}

function render() {
  const h = mixHighlights("m1", room, "de_dust2")
  return renderWithQuery(
    <>
      {h.top}
      {h.bottom}
    </>
  )
}

describe("MixHighlights", () => {
  it("MVP con la imagen del admin y los destacados", async () => {
    api({ image: MVP })
    const { container } = render()
    const mvp = await screen.findByRole("region", { name: "MVP" })
    expect(within(mvp).getByText("kyan")).toBeInTheDocument()
    expect(within(mvp).getByText("1.60")).toBeInTheDocument()
    const destacados = screen.getByRole("list", { name: "Destacados" })
    expect(within(destacados).getByText("Más kills")).toBeInTheDocument()
    await vi.waitFor(() =>
      expect(container.querySelector(`img[src="${MVP}"]`)).not.toBeNull()
    )
  })

  it("sin imagen la tarjeta queda lisa y sin clips no hay 'Lo más destacado'", async () => {
    api({ image: null })
    const { container } = render()
    await screen.findByRole("region", { name: "MVP" })
    expect(container.querySelector("[data-photo]")).toBeNull()
    expect(
      screen.queryByRole("region", { name: "Lo más destacado de la partida" })
    ).toBeNull()
  })

  it("pide la foto del perfil de los que tienen ficha (MVP y destacados), no de los invitados", async () => {
    api({})
    const pedidos: string[] = []
    server.use(
      http.get(`${API}/api/v1/players/:nick`, ({ params }) => {
        pedidos.push(String(params.nick))
        return HttpResponse.json({
          photo_url: "https://x.test/kyan.webp",
          details: null,
        })
      })
    )
    const conFicha = {
      ...room,
      side1: { players: [{ ...room.side1.players[0], alias: "kyan" }] },
    } as unknown as Room
    const h = mixHighlights("m1", conFicha, "de_dust2")
    renderWithQuery(<>{h.top}</>)
    await screen.findByRole("region", { name: "MVP" })
    await vi.waitFor(() => expect(pedidos).toEqual(["kyan"]))
  })

  it("con clips muestra 'Lo más destacado'", async () => {
    api({
      clips: [
        {
          id: "c1",
          type: "ace",
          round: 7,
          player: { id: "p1", alias: "kyan" },
          game_nick: "kyan",
          kills: 5,
          video: {
            status: "pending",
            url: null,
            embed_url: null,
            seconds: null,
          },
        },
      ],
    })
    render()
    expect(
      await screen.findByRole("region", {
        name: "Lo más destacado de la partida",
      })
    ).toBeInTheDocument()
  })
})
