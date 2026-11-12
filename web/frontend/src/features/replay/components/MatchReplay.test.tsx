import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MatchReplay } from "./MatchReplay"

const TRK = [
  "V 1 de_dust2 66 33",
  "R 1 0",
  "J 1 2 STEAM_0:1:1 Uno",
  "J 2 3 STEAM_0:1:2 Dos",
  "Z 66",
  "F 66 1,0,0,0,0,100;2,100,100,0,180,100",
  "K 132 1 2 ak47 1 0 0 100 100",
  "E 200 2 9",
  "R 2 300",
  "F 310 1,0,0,0,0,100",
  "E 400 3 12",
].join("\n")

const RADAR = {
  de_dust2: {
    minx: -100,
    maxy: 300,
    width: 600,
    height: 600,
    minz: 0,
    maxz: 10,
  },
}

function renderWith(url: string | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MatchReplay trackUrl={url} />
    </QueryClientProvider>
  )
}

afterEach(() => vi.unstubAllGlobals())

describe("MatchReplay", () => {
  it("sin .trk no muestra nada ni pide nada", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { container } = renderWith(null)
    expect(container).toBeEmptyDOMElement()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("baja el .trk y muestra las rondas, el radar y el mapa de calor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/radar/index.json")
          ? new Response(JSON.stringify(RADAR))
          : new Response(TRK)
      )
    )
    renderWith("https://demos.test/track/srv1-x")
    expect(
      await screen.findByRole("tab", { name: "Ronda 1, ganan los T" })
    ).toHaveAttribute("aria-selected", "true")
    expect(
      screen.getByRole("tab", { name: "Ronda 2, ganan los CT" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("img", { name: /Radar de de_dust2, ronda 1/ })
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole("radio", { name: "Mapa de calor" }))
    expect(
      screen.getByRole("img", { name: /Mapa de calor de de_dust2/ })
    ).toBeInTheDocument()
    expect(screen.getByText("1 kills")).toBeInTheDocument()
  })

  it("si el radar del mapa no existe, lo dice", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/radar/index.json")
          ? new Response("{}")
          : new Response(TRK)
      )
    )
    renderWith("https://demos.test/track/srv1-x")
    expect(
      await screen.findByText("Todavía no tenemos el radar de de_dust2.")
    ).toBeInTheDocument()
  })
})
