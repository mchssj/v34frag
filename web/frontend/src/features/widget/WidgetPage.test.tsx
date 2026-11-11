import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { render, screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { localMidnight } from "./api"
import { WidgetPage } from "./WidgetPage"

const API = "http://api.test"
const ID = "11111111-1111-4111-8111-111111111111"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const WIDGET = {
  id: ID,
  nick: "Mecha",
  team_tag: "ALF",
  country: "Argentina",
  photo_url: null,
  elo: 1180,
  peak_elo: 1240,
  rank: 7,
  country_rank: 2,
  period: {
    v: 2,
    d: 1,
    e: 0,
    elo: 23,
    kills: 61,
    deaths: 48,
    rounds: 70,
    damage: 6100,
    headshots: 30,
    k3: 2,
    k4: 1,
    k5: 0,
    sniper: 4,
    knife: 0,
    clutches: 1,
    entries: 9,
    pistols: 3,
    rating: 1.14,
  },
  ultimos: [
    { r: "V", elo: 14 },
    { r: "D", elo: -12 },
    { r: "V", elo: 21 },
  ],
  settings: null as string | null,
}

async function open(search: string) {
  const queryClient = new QueryClient()
  const router = createRouter({
    routeTree: createRootRoute({ component: WidgetPage }),
    history: createMemoryHistory({ initialEntries: [`/${search}`] }),
  })
  await router.load()
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>
  )
}

describe("página /widget", () => {
  it("sin id: lo avisa y no consulta la API", async () => {
    await open("?d=mini")
    expect(
      await screen.findByText("Falta el jugador en la URL")
    ).toBeInTheDocument()
  })

  it("con datos: dibuja el diseño de la URL y, sin período, pide el guardado desde la medianoche local", async () => {
    let query: URLSearchParams | null = null
    server.use(
      http.get(`${API}/api/v1/players/${ID}/widget`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json(WIDGET)
      })
    )
    await open(`?id=${ID}&d=completo&a=00b4ff`)
    expect(await screen.findByText("Mecha")).toBeInTheDocument()
    expect(screen.getByText("ALF")).toBeInTheDocument()
    expect(query!.get("period")).toBeNull()
    expect(query!.get("since")).toBe(localMidnight())
  })

  it("solo con el id: usa lo guardado, y lo de la URL gana", async () => {
    server.use(
      http.get(`${API}/api/v1/players/${ID}/widget`, () =>
        HttpResponse.json({ ...WIDGET, settings: "d=stats&f=Lo+guardado" })
      )
    )
    const a = await open(`?id=${ID}`)
    expect(await screen.findByText("Lo guardado")).toBeInTheDocument()
    expect(screen.getByText("Ranking:")).toBeInTheDocument()
    a.unmount()

    await open(`?id=${ID}&f=De+la+URL`)
    expect(await screen.findByText("De la URL")).toBeInTheDocument()
    expect(screen.queryByText("Lo guardado")).toBeNull()
  })

  it("el período de la URL va a la API", async () => {
    let period: string | null = null
    server.use(
      http.get(`${API}/api/v1/players/${ID}/widget`, ({ request }) => {
        period = new URL(request.url).searchParams.get("period")
        return HttpResponse.json(WIDGET)
      })
    )
    await open(`?id=${ID}&v=temporada`)
    await screen.findByText("Mecha")
    expect(period).toBe("season")
  })

  it("ficha que no existe: Jugador no encontrado", async () => {
    server.use(
      http.get(`${API}/api/v1/players/${ID}/widget`, () =>
        HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "No existe ese jugador." } },
          { status: 404 }
        )
      )
    )
    await open(`?id=${ID}`)
    expect(await screen.findByText("Jugador no encontrado")).toBeInTheDocument()
  })

  it("sin conexión y sin nada mostrado: lo avisa", async () => {
    server.use(
      http.get(`${API}/api/v1/players/${ID}/widget`, () => HttpResponse.error())
    )
    await open(`?id=${ID}`)
    await waitFor(
      () =>
        expect(
          screen.getByText("Sin conexión, reintentando…")
        ).toBeInTheDocument(),
      { timeout: 8000 }
    )
  }, 10_000)
})
