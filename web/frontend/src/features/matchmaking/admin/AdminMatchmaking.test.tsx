import { act, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import { renderWithQuery } from "@/test/render"
import { createDemoSource } from "../demo"
import { MmSourceContext } from "../source"
import { AdminMatchmaking } from "./AdminMatchmaking"

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

function setup() {
  const demo = createDemoSource({ random: () => 0.5 })
  const view = renderWithQuery(
    <TooltipProvider>
      <MmSourceContext value={demo.source}>
        <AdminMatchmaking />
      </MmSourceContext>
    </TooltipProvider>
  )
  return { ...demo, ...view }
}

describe("Administración › Matchmaking", () => {
  it("General: habilitar 1v1 y guardar cambia los modos de Jugar", async () => {
    const { user, source } = setup()
    const save = screen.findByRole("button", { name: "Guardar cambios" })
    expect(await save).toBeDisabled()

    await user.click(screen.getByRole("switch", { name: "1v1" }))
    await user.click(await save)
    expect((await source.state()).modes.map((m) => m.mode)).toEqual([
      "5v5",
      "2v2",
      "1v1",
    ])
  })

  it("General: imagen del MVP, sin imagen se ofrece subirla; con imagen, quitarla", async () => {
    const { user, source, queryClient } = setup()
    expect(
      await screen.findByRole("button", { name: "Subir imagen" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull()

    // Subir pasa por el recorte (canvas): acá se sube por la fuente y se vuelve a pedir la configuración.
    await source.uploadMvpImage(new Blob(["x"], { type: "image/webp" }))
    await act(() => queryClient.invalidateQueries())
    expect(
      await screen.findByRole("img", { name: "Imagen actual del MVP" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Quitar" }))
    expect(
      await screen.findByRole("button", { name: "Subir imagen" })
    ).toBeInTheDocument()
    expect((await source.adminConfig()).mvp_image_url).toBeNull()
  })

  it("General: no deja apagar todos los modos", async () => {
    const { user } = setup()
    await user.click(await screen.findByRole("switch", { name: "5v5" }))
    await user.click(screen.getByRole("switch", { name: "2v2" }))
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }))
    expect(
      await screen.findByText("Tiene que quedar al menos un modo habilitado")
    ).toBeInTheDocument()
  })

  it("Mapas: sumar uno y guardar lo pone en el veto; con menos de 2 no guarda", async () => {
    const { user, source } = setup()
    await user.click(screen.getByRole("tab", { name: "Mapas" }))
    await user.click(
      await screen.findByRole("switch", { name: "de_dust en el veto" })
    )
    await user.click(screen.getByRole("button", { name: "Guardar mapas" }))
    expect(
      (await source.adminMaps("5v5")).filter((m) => m.in_mm).map((m) => m.name)
    ).toContain("de_dust")

    for (const sw of screen.getAllByRole("switch", { checked: true }))
      await user.click(sw)
    expect(screen.getByRole("button", { name: "Guardar mapas" })).toBeDisabled()
  })

  it("Mapas: cada modo tiene su veto", async () => {
    const { user } = setup()
    await user.click(screen.getByRole("tab", { name: "Mapas" }))
    expect(await screen.findByText("Mapas del veto en 5v5")).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "2v2" }))
    expect(await screen.findByText("Mapas del veto en 2v2")).toBeInTheDocument()
    expect(
      screen.getByRole("switch", { name: "aim_map en el veto" })
    ).toBeChecked()
    expect(
      screen.getByRole("switch", { name: "de_nuke en el veto" })
    ).not.toBeChecked()
  })

  it("General: 2v2 no da ELO por defecto y se puede cambiar", async () => {
    const { user, source } = setup()
    const elo = await screen.findByRole("switch", { name: "2v2 da ELO" })
    expect(elo).not.toBeChecked()
    await user.click(elo)
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }))
    const cfg = await source.adminConfig()
    expect(cfg.modes.find((m) => m.mode === "2v2")!.affects_elo).toBe(true)
  })

  it("General: equipos parejos con el rating, apagado por defecto; encenderlo y cambiar el tope", async () => {
    const { user, source } = setup()
    const sw = await screen.findByRole("switch", { name: "Apagado" })
    expect(sw).not.toBeChecked()
    expect(
      screen.getByText(/1,40 de rating en 20 mapas, el ELO de armado es \+64/)
    ).toBeInTheDocument()

    await user.click(sw)
    const cap = screen.getByLabelText("Tope del ajuste (±)")
    await user.clear(cap)
    await user.type(cap, "50")
    expect(
      screen.getByText(/1,40 de rating en 20 mapas, el ELO de armado es \+50/)
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }))
    const cfg = await source.adminConfig()
    expect(cfg.balance_rating).toBe(true)
    expect(cfg.balance_rating_cap).toBe(50)
    expect(cfg.balance_rating_weight).toBe(200)
  })

  it("General: reemplazos apagados por defecto; encenderlos y cambiar el porcentaje del voto", async () => {
    const { user, source } = setup()
    const sw = await screen.findByRole("switch", { name: "Reemplazos" })
    expect(sw).not.toBeChecked()
    await user.click(sw)
    const pct = screen.getByLabelText("!callreplace pasa con más del (%)")
    await user.clear(pct)
    await user.type(pct, "90")
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }))
    const cfg = await source.adminConfig()
    expect(cfg.replace_enabled).toBe(true)
    expect(cfg.replace_vote_pct).toBe(90)
    expect(cfg.replace_link_minutes).toBe(10)
  })

  it("Reportes: excluir crea la exclusión; las sanciones se levantan en Baneos", async () => {
    const { user, source } = setup()
    await user.click(screen.getByRole("tab", { name: "Reportes" }))
    await user.click(await screen.findByRole("button", { name: "Excluir 3 d" }))
    await vi.waitFor(async () =>
      expect((await source.adminBans())[0]?.nick).toBe("gordo")
    )
    expect(
      screen.getByRole("link", { name: "Baneos › Matchmaking" })
    ).toHaveAttribute("href", "/admin/bans")
    expect(screen.queryByText("Sanciones de la cola")).toBeNull()
  })

  it("Métricas: suma los días por modo", async () => {
    const { user } = setup()
    await user.click(screen.getByRole("tab", { name: "Métricas" }))
    expect(
      await screen.findByRole("heading", { name: "5v5" })
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "2v2" })).toBeInTheDocument()
    expect(screen.getAllByText("Espera p90")).toHaveLength(2)
  })

  it("Servidores: muestra la contraseña oculta y deja sacar un servidor", async () => {
    const { user, source } = setup()
    await user.click(screen.getByRole("tab", { name: "Servidores" }))
    expect(
      (await screen.findAllByLabelText("Contraseña oculta")).length
    ).toBeGreaterThan(0)
    await user.click(
      screen.getByRole("switch", { name: "CM League #1 en el matchmaking" })
    )
    expect((await source.adminServers())[0]!.mm_enabled).toBe(false)
  })
  it("Salas: Ver sala abre la sala con lo del admin y Cancelar sala la cancela", async () => {
    const { user, source, controls } = setup()
    await source.join("5v5", null)
    for (let i = 0; i < 10; i++) {
      if ((await source.state()).lobby?.status === "live") break
      controls.skip()
    }
    await user.click(screen.getByRole("tab", { name: "Salas" }))
    await user.click(await screen.findByRole("button", { name: "Ver sala" }))

    expect(
      await screen.findByRole("region", { name: "Sala de la partida" })
    ).toBeInTheDocument()
    const admin = screen.getByRole("region", {
      name: "Administración de la sala",
    })
    expect(screen.getAllByRole("button", { name: /^Banear a / })).toHaveLength(
      10
    )
    // Nada del que mira como jugador: ni reportar ni el chat.
    expect(screen.queryByRole("button", { name: /Reportar/ })).toBeNull()
    expect(screen.queryByText("(tú)")).toBeNull()

    await user.click(
      within(admin).getByRole("button", { name: "Cancelar sala" })
    )
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Cancelar sala",
      })
    )
    await vi.waitFor(async () =>
      expect(await source.adminLobbies()).toEqual([])
    )

    await user.click(screen.getByRole("button", { name: "Salas" }))
    expect(await screen.findByText("No hay salas activas.")).toBeInTheDocument()
  })
})
