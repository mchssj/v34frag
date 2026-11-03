import { act, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

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
    <MmSourceContext value={demo.source}>
      <AdminMatchmaking />
    </MmSourceContext>
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

  it("Reportes: excluir crea la exclusión y se puede levantar", async () => {
    const { user, source } = setup()
    await user.click(screen.getByRole("tab", { name: "Reportes" }))
    await user.click(await screen.findByRole("button", { name: "Excluir 3 d" }))
    expect(await screen.findByText(/AFK · hasta/)).toBeInTheDocument()
    expect((await source.adminBans())[0]!.nick).toBe("gordo")
    const excluded = screen.getByText(/AFK · hasta/).closest("li")!
    await user.click(within(excluded).getByRole("button", { name: "Levantar" }))
    expect(await screen.findByText("Nadie excluido.")).toBeInTheDocument()
  })

  it("Reportes: sanciones de la cola con motivo y nivel; levantar pide motivo", async () => {
    const { user, source } = setup()
    await user.click(screen.getByRole("tab", { name: "Reportes" }))
    const row = (
      await screen.findByText(/No aceptaste una partida · Nivel 2 de 4/)
    ).closest("li")!
    expect(within(row).getByText("colo")).toBeInTheDocument()
    await user.click(within(row).getByRole("button", { name: "Levantar" }))

    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("su nivel baja de 2 a 1")
    const confirm = within(dialog).getByRole("button", { name: "Levantar" })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText("Motivo"), "Se cayó Steam")
    await user.click(confirm)

    expect(await screen.findByText("Nadie sancionado.")).toBeInTheDocument()
    expect(await source.adminPenalties()).toEqual([])
  })

  it("Reportes: levantar la propia sanción la saca de Jugar", async () => {
    const { source, controls } = setup()
    await source.join("5v5", null)
    controls.skip()
    await source.decline()
    const mine = async () =>
      (await source.adminPenalties()).find((p) => p.user_id === "me")
    expect((await mine())?.reason).toBe("Rechazaste una partida")
    await source.liftPenalty("me", "Prueba")
    expect(await mine()).toBeUndefined()
    expect((await source.state()).penalty).toBeNull()
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
})
