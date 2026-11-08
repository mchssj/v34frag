import { screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { renderWithQuery } from "@/test/render"
import { handlers, pagina, server, setupApi } from "../test/fixtures"
import { ManualMarkdown } from "./ManualMarkdown"

vi.mock("@tanstack/react-router", async (orig) =>
  (await import("@/features/ranking/test/router")).mockRouter(orig)
)

setupApi()
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:captura")
})

describe("ManualMarkdown", () => {
  it("dibuja el texto, la tabla, el aviso y los links", () => {
    server.use(handlers.imagen())
    renderWithQuery(
      <ManualMarkdown markdown={pagina.markdown} seccion="jugador" />
    )

    expect(
      screen.getByText("Buscar partida", { selector: "strong" })
    ).toBeInTheDocument()
    expect(screen.getByRole("note")).toHaveTextContent(
      "Ojo: si no aceptas a tiempo, pierdes el lugar."
    )
    expect(screen.getByRole("table")).toHaveTextContent("Aceptar")

    expect(screen.getByRole("link", { name: "Jugar" })).toHaveAttribute(
      "href",
      "/play"
    )
    expect(screen.getByRole("link", { name: "Vincular" })).toHaveAttribute(
      "href",
      "/help/jugador/vincular-steamid"
    )
    const discord = screen.getByRole("link", { name: "Discord" })
    expect(discord).toHaveAttribute("target", "_blank")
    expect(discord).toHaveAttribute("rel", "noreferrer")
    // Un link raro queda como texto.
    expect(screen.queryByRole("link", { name: "raro" })).toBeNull()
    expect(screen.getByText("raro")).toBeInTheDocument()
  })

  it("pide la captura con la sesión y la muestra", async () => {
    server.use(handlers.imagen())
    renderWithQuery(
      <ManualMarkdown
        markdown="![El botón](img/buscar.webp)"
        seccion="jugador"
      />
    )
    expect(
      await screen.findByRole("img", { name: "El botón" })
    ).toHaveAttribute("src", "blob:captura")
  })

  it("si la captura no llega, lo dice", async () => {
    server.use(handlers.noExiste("jugador/img/buscar.webp"))
    renderWithQuery(
      <ManualMarkdown
        markdown="![El botón](img/buscar.webp)"
        seccion="jugador"
      />
    )
    expect(
      await screen.findByText("No se pudo cargar la captura: El botón.")
    ).toBeInTheDocument()
  })
})
