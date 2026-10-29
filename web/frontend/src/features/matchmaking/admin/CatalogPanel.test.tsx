import { screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { renderWithQuery } from "@/test/render"
import { DEMO_POOL, createDemoSource } from "../demo"
import { mapLabel } from "../labels"
import { MmSourceContext } from "../source"
import { CatalogPanel } from "./CatalogPanel"

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
)
vi.mock("sonner", () => ({ toast }))

function setup() {
  const demo = createDemoSource({ random: () => 0.5 })
  const view = renderWithQuery(
    <MmSourceContext value={demo.source}>
      <CatalogPanel />
    </MmSourceContext>
  )
  return { ...demo, ...view }
}

const png = (kb: number) =>
  new File([new Uint8Array(kb * 1024)], "mapa.png", { type: "image/png" })

describe("mapLabel", () => {
  it("arma el nombre visible desde el del servidor", () => {
    expect(mapLabel("de_dust2")).toBe("Dust2")
    expect(mapLabel("cs_office")).toBe("Office")
    expect(mapLabel("de_cbble", "Cobblestone")).toBe("Cobblestone")
  })
})

describe("Catálogo de mapas", () => {
  it("el 5v5 arranca con los 9 mapas más jugados", () => {
    expect(DEMO_POOL.map((m) => mapLabel(m))).toEqual([
      "Dust2",
      "Inferno",
      "Tuscan",
      "Nuke",
      "Season",
      "Cbble",
      "Cache",
      "Train",
      "Mirage",
    ])
  })

  it("muestra cada mapa con su nombre visible y avisa cuando falta el fondo", async () => {
    setup()
    expect(await screen.findByText("Cobblestone")).toBeInTheDocument()
    const season = screen.getByText("Season").closest("li")!
    expect(
      within(season).getByText("Sin fondo: usa la imagen")
    ).toBeInTheDocument()
    const cache = screen.getByText("Cache").closest("li")!
    expect(within(cache).getByLabelText("Sin imagen")).toBeInTheDocument()
  })

  it("agrega un mapa nuevo con nombre visible y versiones", async () => {
    const { user, source } = setup()
    await user.click(
      await screen.findByRole("button", { name: "Agregar mapa" })
    )
    await user.type(
      screen.getByLabelText("Nombre en el servidor"),
      "de_vertigo"
    )
    await user.type(screen.getByLabelText("Nombre visible"), "Vértigo")
    await user.type(
      screen.getByLabelText("Otras versiones del servidor"),
      "de_vertigo_b2"
    )
    await user.click(screen.getByRole("button", { name: "Agregar" }))
    const map = (await source.adminCatalog()).find(
      (m) => m.name === "de_vertigo"
    )
    expect(map).toMatchObject({
      display_name: "Vértigo",
      versions: ["de_vertigo", "de_vertigo_b2"],
      active: true,
    })
  })

  it("no deja agregar un nombre inválido o repetido", async () => {
    const { user } = setup()
    await user.click(
      await screen.findByRole("button", { name: "Agregar mapa" })
    )
    await user.type(screen.getByLabelText("Nombre en el servidor"), "De Dust")
    expect(screen.getByText(/Minúsculas, números y _/)).toBeInTheDocument()
    await user.clear(screen.getByLabelText("Nombre en el servidor"))
    await user.type(screen.getByLabelText("Nombre en el servidor"), "de_nuke")
    expect(
      screen.getByText("Ese mapa ya está en el catálogo")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Agregar" })).toBeDisabled()
  })

  it("sube la imagen de un mapa que no tenía", async () => {
    const { user, source } = setup()
    await screen.findByText("Cache")
    await user.upload(
      screen.getByLabelText("Archivo de imagen de Cache"),
      png(100)
    )
    const cache = (await source.adminCatalog()).find(
      (m) => m.name === "de_cache"
    )
    expect(cache?.image_url).not.toBeNull()
    expect(toast.success).toHaveBeenCalledWith("Imagen de Cache actualizada")
  })

  it("rechaza un fondo de más de 4 MB sin mandarlo", async () => {
    const { user, source } = setup()
    await screen.findByText("Season")
    const spy = vi.spyOn(source, "uploadMapArt")
    await user.upload(
      screen.getByLabelText("Archivo de fondo de Season"),
      png(5 * 1024)
    )
    expect(toast.error).toHaveBeenCalledWith(
      "La imagen del fondo pesa más de 4 MB"
    )
    expect(spy).not.toHaveBeenCalled()
  })

  it("retirar un mapa lo saca del veto de todos los modos", async () => {
    const { user, source } = setup()
    await user.click(
      await screen.findByRole("button", { name: "Editar Dust2" })
    )
    await user.click(screen.getByRole("switch"))
    await user.click(screen.getByRole("button", { name: "Guardar" }))
    expect(
      (await source.adminMaps("5v5")).filter((m) => m.in_mm).map((m) => m.name)
    ).not.toContain("de_dust2")
    expect(
      (await source.adminMaps("2v2")).filter((m) => m.in_mm).map((m) => m.name)
    ).not.toContain("de_dust2")
  })
})
