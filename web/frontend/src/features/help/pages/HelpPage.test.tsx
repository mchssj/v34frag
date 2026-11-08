import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { renderWithQuery } from "@/test/render"
import { handlers, server, setupApi } from "../test/fixtures"
import { HelpPage } from "./HelpPage"

vi.mock("@tanstack/react-router", async (orig) =>
  (await import("@/features/ranking/test/router")).mockRouter(orig)
)

setupApi()

describe("Página de la ayuda", () => {
  it("muestra el título, el texto y las demás páginas de la sección", async () => {
    URL.createObjectURL = vi.fn(() => "blob:captura")
    server.use(handlers.indice(), handlers.pagina(), handlers.imagen())
    renderWithQuery(<HelpPage seccion="jugador" tarea="buscar-partida" />)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Buscar partida" })
    ).toBeInTheDocument()
    expect(screen.getByRole("note")).toBeInTheDocument()
    const nav = await screen.findByRole("navigation", {
      name: "Más en Jugador",
    })
    expect(nav).toHaveTextContent("Vincular tu SteamID")
    expect(screen.getByRole("link", { name: "Ayuda" })).toHaveAttribute(
      "href",
      "/help"
    )
  })

  it("una página que no existe (o de otro rol): aviso y link a la ayuda", async () => {
    server.use(handlers.indice(), handlers.noExiste("admin/servidores"))
    renderWithQuery(<HelpPage seccion="admin" tarea="servidores" />)
    expect(
      await screen.findByText("No encontramos esa página")
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Ir a la ayuda" })).toHaveAttribute(
      "href",
      "/help"
    )
  })
})
