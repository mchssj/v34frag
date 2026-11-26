import { screen, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import { renderWithQuery } from "@/test/render"
import {
  API,
  beta,
  common,
  page,
  profile,
  ranked,
  server,
  standing,
  setupApi,
} from "../test/fixtures"
import { navigate } from "../test/router"
import { PlayersRanking } from "./PlayersRanking"

vi.mock("@tanstack/react-router", async (orig) =>
  (await import("../test/router")).mockRouter(orig)
)

setupApi()

function renderPlayers(search = {}) {
  const onChange = vi.fn()
  const r = renderWithQuery(
    <TooltipProvider>
      <PlayersRanking search={search} onChange={onChange} />
    </TooltipProvider>
  )
  return { ...r, onChange }
}

describe("Ranking → Jugadores", () => {
  it("abre la temporada activa: franja, puesto, medalla y los sin puesto con su avance", async () => {
    common()
    server.use(
      http.get(`${API}/api/v1/seasons/current`, () => HttpResponse.json(beta)),
      http.get(`${API}/api/v1/seasons/s1/standings`, ({ request }) => {
        const eligible = new URL(request.url).searchParams.get("eligible")
        return HttpResponse.json(
          page(
            eligible
              ? [standing("juanma")]
              : [
                  standing("juanma"),
                  standing("Zeta", {
                    player: { id: "me", alias: "Zeta", photo_url: null },
                    rank: 2,
                    medal: null,
                    elo: 2100,
                    elo_after: 2011,
                  }),
                  standing("musul", {
                    rank: null,
                    eligible: false,
                    matches: 12,
                    medal: null,
                    rating: null,
                    kd: null,
                  }),
                ]
          )
        )
      })
    )
    renderPlayers()

    expect(await screen.findByText("EN CURSO")).toBeInTheDocument()
    expect(screen.getByText(/Top 20 con medalla/)).toBeInTheDocument()
    expect(
      await screen.findByRole("columnheader", { name: "Medalla si cierra hoy" })
    ).toBeInTheDocument()

    const musul = await within(await screen.findByRole("table")).findByRole(
      "link",
      { name: "musul" }
    )
    expect(within(musul).getByText("12/20")).toBeInTheDocument()
    // Sin puesto, sin rating, sin K/D y sin medalla.
    expect(within(musul).getAllByText("—")).toHaveLength(4)
    expect(within(musul).getByText("Sin equipo")).toBeInTheDocument()

    // El usuario resaltado y el reinicio del nivel 10 "si cerrara hoy".
    const me = within(screen.getByRole("table")).getByRole("link", {
      name: "Zeta",
    })
    expect(me).toHaveAttribute("aria-current", "true")
    expect(within(me).getByText("2011")).toBeInTheDocument()

    // El podio son los 3 primeros con puesto.
    const podium = await screen.findByRole("list", { name: "Podio" })
    expect(within(podium).getByText("juanma")).toBeInTheDocument()
  })

  it("temporada: equipo, rating, K/D, pico debajo del ELO, filtro de nivel y orden", async () => {
    common()
    const asked = vi.fn()
    server.use(
      http.get(`${API}/api/v1/seasons/current`, () => HttpResponse.json(beta)),
      http.get(`${API}/api/v1/seasons/s1/standings`, ({ request }) => {
        asked(Object.fromEntries(new URL(request.url).searchParams))
        return HttpResponse.json(
          page([
            standing("flow", {
              teams: [
                { id: "t1", name: "Furia Sur", tag: "FUR" },
                { id: "t2", name: "Los Pibes", tag: "LP" },
                { id: "t3", name: "Mix Norte", tag: "MN" },
              ],
              rating: 1.152,
              kd: 1.19,
              elo: 1890,
              peak_elo: 1932,
            }),
          ])
        )
      })
    )
    const { user, onChange } = renderPlayers({ level: "7-9", sort: "kd" })

    const flow = await within(await screen.findByRole("table")).findByRole(
      "link",
      { name: "flow" }
    )
    expect(within(flow).getByText("Furia Sur")).toBeInTheDocument()
    expect(
      within(flow).getByLabelText("También en Los Pibes, Mix Norte")
    ).toHaveTextContent("+2")
    expect(within(flow).getByText("1.15")).toBeInTheDocument()
    expect(within(flow).getByText("1.19")).toBeInTheDocument()
    expect(within(flow).getByText("máx. 1932")).toBeInTheDocument()
    expect(
      screen.queryByRole("columnheader", { name: "Pico" })
    ).not.toBeInTheDocument()
    expect(asked).toHaveBeenCalledWith(
      expect.objectContaining({ level: "7-9", sort: "kd", order: "desc" })
    )

    await user.click(screen.getByRole("radio", { name: "Nivel 10" }))
    expect(onChange).toHaveBeenLastCalledWith({ level: "10", page: undefined })
    await user.click(screen.getByRole("button", { name: /Rating/ }))
    expect(onChange).toHaveBeenLastCalledWith({
      sort: "rating",
      order: undefined,
      page: undefined,
    })
  })

  it("sin temporada activa abre el Histórico", async () => {
    common()
    server.use(
      http.get(`${API}/api/v1/seasons/current`, () =>
        HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "No hay" } },
          { status: 404 }
        )
      ),
      http.get(`${API}/api/v1/ranking/players`, () =>
        HttpResponse.json(
          page([
            ranked("musul", {
              teams: [
                { id: "t1", name: "GO TO KNOW", tag: "GTK" },
                { id: "t3", name: "OLDteam", tag: "" },
              ],
            }),
          ])
        )
      )
    )
    renderPlayers()

    expect(
      await screen.findByText(
        "Todas las partidas jugadas en el servidor, sin temporadas."
      )
    ).toBeInTheDocument()
    const row = await within(await screen.findByRole("table")).findByRole(
      "link",
      { name: "musul" }
    )
    expect(within(row).getByText("AWPer · Argentina")).toBeInTheDocument()
    expect(
      within(row).getByRole("button", { name: "También en OLDteam" })
    ).toHaveTextContent("+1")
    expect(
      within(row).getByRole("img", { name: "Sube en sus últimos mixes" })
    ).toBeInTheDocument()
  })

  it("el podio no cambia al filtrar por nivel", async () => {
    common()
    const asked: string[] = []
    server.use(
      http.get(`${API}/api/v1/ranking/players`, ({ request }) => {
        const p = new URL(request.url).searchParams
        asked.push(p.toString())
        return HttpResponse.json(
          page(p.get("per") === "3" ? [ranked("musul")] : [ranked("nacho")])
        )
      })
    )
    const { user, onChange } = renderPlayers({ season: "all", level: "1-6" })

    const podium = await screen.findByRole("list", { name: "Podio" })
    expect(within(podium).getByText("musul")).toBeInTheDocument()
    await screen.findByRole("link", { name: "nacho" })
    // El podio se pide sin filtros; la tabla con el nivel.
    expect(asked).toContain("per=3")
    expect(asked.some((q) => q.includes("level=1-6"))).toBe(true)

    await user.click(screen.getByRole("radio", { name: "Nivel 10" }))
    expect(onChange).toHaveBeenCalledWith({ level: "10", page: undefined })
  })

  describe("filtros avanzados", () => {
    function api(vip: boolean) {
      common()
      const asked: Record<string, string>[] = []
      server.use(
        http.get(`${API}/api/v1/me/profile`, () =>
          HttpResponse.json({
            ...profile,
            vip: vip ? { active: true, lifetime: true, until: null } : null,
          })
        ),
        http.get(`${API}/api/v1/me/searches`, () =>
          HttpResponse.json(
            page(
              vip
                ? [
                    {
                      id: "b1",
                      kind: "players",
                      name: "Finos",
                      query: { hs: 50 },
                      created_at: "2026-11-24T00:00:00Z",
                    },
                  ]
                : []
            )
          )
        ),
        http.get(`${API}/api/v1/maps`, () => HttpResponse.json(page([]))),
        http.get(`${API}/api/v1/ranking/players`, ({ request }) => {
          const p = Object.fromEntries(new URL(request.url).searchParams)
          if (p.per !== "3") asked.push(p)
          return HttpResponse.json(page([ranked("musul", { hs: 48.2 })]))
        })
      )
      return asked
    }

    it("con VIP se mandan, suman su columna y una guardada reemplaza lo que había", async () => {
      const asked = api(true)
      const { user, onChange } = renderPlayers({
        season: "all",
        hs: 40,
        level: "10",
      })
      expect(
        await screen.findByRole("columnheader", { name: "HS %" })
      ).toBeInTheDocument()
      expect(await screen.findByText("48%")).toBeInTheDocument()
      // Una sola búsqueda, ya con el filtro.
      expect(asked).toHaveLength(1)
      expect(asked[0]).toMatchObject({ hs_min: "40", level: "10" })

      await user.click(
        screen.getByRole("button", { name: "Quitar HS desde 40 %" })
      )
      expect(onChange).toHaveBeenLastCalledWith({
        hs: undefined,
        page: undefined,
      })
      await user.click(await screen.findByRole("button", { name: "Finos" }))
      expect(onChange).toHaveBeenLastCalledWith({ hs: 50 })
    })

    it("sin VIP no se mandan y el panel dice cómo tenerlos", async () => {
      const asked = api(false)
      const { user } = renderPlayers({ season: "all", hs: 40 })
      await screen.findByText("No se aplican sin VIP.")
      await within(await screen.findByRole("table")).findByRole("link", {
        name: "musul",
      })
      expect(asked[0]).not.toHaveProperty("hs_min")
      expect(
        screen.queryByRole("columnheader", { name: "HS %" })
      ).not.toBeInTheDocument()
      await user.click(
        screen.getByRole("button", { name: /Filtros avanzados/ })
      )
      expect(
        screen.getByText(/son para los VIP\. Buscar, el nivel y el orden/)
      ).toBeInTheDocument()
    })
  })

  it("clic en una fila abre el perfil", async () => {
    common()
    server.use(
      http.get(`${API}/api/v1/ranking/players`, () =>
        HttpResponse.json(page([ranked("musul")]))
      )
    )
    const { user } = renderPlayers({ season: "all" })
    await user.click(
      await within(await screen.findByRole("table")).findByRole("link", {
        name: "musul",
      })
    )
    expect(navigate).toHaveBeenCalledWith({
      to: "/player/$nick",
      params: { nick: "musul" },
    })
  })
})
