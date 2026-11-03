import { screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { renderWithQuery } from "@/test/render"
import { handlers, indice, server, setupApi } from "../test/fixtures"
import { HelpIndex } from "./HelpIndex"

vi.mock("@tanstack/react-router", async (orig) =>
  (await import("@/features/ranking/test/router")).mockRouter(orig)
)

setupApi()

describe("Ayuda", () => {
  it("abre en la sección del rol más alto y deja cambiar", async () => {
    server.use(handlers.indice())
    const onSeccion = vi.fn()
    const { user } = renderWithQuery(
      <HelpIndex seccion={undefined} onSeccion={onSeccion} />
    )

    expect(
      await screen.findByRole("link", { name: /Iniciar una partida/ })
    ).toBeInTheDocument()
    expect(screen.queryByText("Buscar partida")).toBeNull()

    await user.click(screen.getByRole("radio", { name: "Jugador" }))
    expect(onSeccion).toHaveBeenCalledWith("jugador")
  })

  it("muestra la sección de la URL, en orden", async () => {
    server.use(handlers.indice())
    renderWithQuery(<HelpIndex seccion="jugador" onSeccion={vi.fn()} />)
    const items = await screen.findAllByRole("listitem")
    expect(items.map((i) => within(i).getByRole("link").textContent)).toEqual([
      expect.stringContaining("Vincular tu SteamID"),
      expect.stringContaining("Buscar partida"),
    ])
  })

  it("con una sola sección no muestra los filtros", async () => {
    server.use(
      handlers.indice({ inicio: "jugador", secciones: [indice.secciones[0]!] })
    )
    renderWithQuery(<HelpIndex seccion={undefined} onSeccion={vi.fn()} />)
    await screen.findByText("Buscar partida")
    expect(screen.queryByRole("radio")).toBeNull()
  })

  it("busca en todas las secciones, sin tildes", async () => {
    server.use(handlers.indice())
    const { user } = renderWithQuery(
      <HelpIndex seccion={undefined} onSeccion={vi.fn()} />
    )
    const box = await screen.findByLabelText("Buscar en la ayuda")
    await user.type(box, "steamid")
    expect(screen.getByText("Vincular tu SteamID")).toBeInTheDocument()
    expect(screen.queryByText("Iniciar una partida")).toBeNull()

    await user.clear(box)
    await user.type(box, "xyz")
    expect(screen.getByText("Sin resultados")).toBeInTheDocument()
  })

  it("sin páginas, lo dice", async () => {
    server.use(handlers.indice({ inicio: "jugador", secciones: [] }))
    renderWithQuery(<HelpIndex seccion={undefined} onSeccion={vi.fn()} />)
    expect(
      await screen.findByText("Todavía no hay páginas")
    ).toBeInTheDocument()
  })
})
