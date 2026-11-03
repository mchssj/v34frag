import { screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { renderWithQuery } from "@/test/render"
import { createDemoSource } from "../demo"
import { MmSourceContext } from "../source"
import { SanctionsPanel } from "./SanctionsPanel"

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

function setup() {
  const demo = createDemoSource({ random: () => 0.5 })
  const view = renderWithQuery(
    <MmSourceContext value={demo.source}>
      <SanctionsPanel />
    </MmSourceContext>
  )
  return { ...demo, ...view }
}

describe("Baneos › Matchmaking", () => {
  it("sanciones de la cola con motivo y nivel; levantar pide motivo", async () => {
    const { user, source } = setup()
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

  it("una exclusión puesta desde un reporte se puede levantar", async () => {
    const { user, source, queryClient } = setup()
    expect(await screen.findByText("Nadie excluido.")).toBeInTheDocument()
    const report = (await source.adminReports())[0]!
    await source.resolveReport(report.id, "ban", 3)
    await queryClient.invalidateQueries()

    const row = (await screen.findByText(/AFK · hasta/)).closest("li")!
    await user.click(within(row).getByRole("button", { name: "Levantar" }))
    expect(await screen.findByText("Nadie excluido.")).toBeInTheDocument()
  })

  it("levantar la propia sanción la saca de Jugar", async () => {
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
})
