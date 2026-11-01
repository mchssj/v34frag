import { expect, test } from "@playwright/test"

import { USER_STATE } from "./helpers"

// Partidas (mixes, PCW y torneos en un solo listado) contra la API local. Solo lee.
test.use({ storageState: USER_STATE })

test("listado: KPIs, tipos en la URL, paginación y sala de un mix", async ({
  page,
}) => {
  await page.goto("/matches")
  await expect(page.getByRole("heading", { name: "Partidas" })).toBeVisible()
  await expect(page.getByText("Jugadores en los últimos 30 días")).toBeVisible()
  await expect(page.getByText(/^Mostrando \d+–\d+ de \d+$/)).toBeVisible()

  const tipo = page.getByRole("group", { name: "Tipo" })
  const rows = page.locator("tbody tr[role=link]")

  // Torneo: series con su formato y el torneo en Detalle.
  await tipo.getByRole("button", { name: "Torneo" }).click()
  await expect(page).toHaveURL(/kind=official/)
  await expect(rows.first()).toContainText("Torneo")

  // Mix: solo mixes.
  await tipo.getByRole("button", { name: "Mix" }).click()
  await expect(page).toHaveURL(/kind=mix/)
  await expect(rows.first()).toContainText("Mix")
  await expect(page.locator("tbody")).not.toContainText("Torneo")

  // Hasta que el backend los tenga (E14 y E15), deshabilitados.
  await expect(
    page.getByRole("button", { name: "Solo donde jugué" })
  ).toBeDisabled()
  await expect(
    page.getByRole("button", { name: "Ocultar canceladas" })
  ).toBeDisabled()

  // Una fila abre su sala; el breadcrumb vuelve a Partidas.
  await rows.first().click()
  await expect(page).toHaveURL(/\/match\//)
  await expect(page.getByText("FINAL")).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" })
  ).toContainText("Partidas")
  await page.getByRole("link", { name: "Volver" }).click()
  await expect(page).toHaveURL(/\/matches\?kind=mix/)
})

test("el mapa filtra aunque el catálogo use el prefijo de_", async ({
  page,
}) => {
  await page.goto("/matches?kind=mix&map=de_cache")
  const rows = page.locator("tbody tr[role=link]")
  await expect(rows.first()).toBeVisible()
  await expect(rows.first()).toContainText("cache")
})

test("los links viejos: /mixes y /matches/results llevan a Partidas", async ({
  page,
}) => {
  await page.goto("/mixes?q=lukas")
  await expect(page).toHaveURL(/\/matches\?.*kind=mix/)
  await expect(page).toHaveURL(/q=lukas/)
  await expect(page.getByRole("heading", { name: "Partidas" })).toBeVisible()

  await page.goto("/matches/results")
  await expect(page).toHaveURL(/\/matches$/)

  // El sidebar ya no tiene Mixes.
  await expect(
    page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Mixes" })
  ).toHaveCount(0)
})

test("un mix en vivo que ya no existe muestra que terminó", async ({
  page,
}) => {
  await page.goto("/mixes/live/no-existe")
  await expect(page.getByText("Este mix terminó.")).toBeVisible()
  await expect(page.getByRole("link", { name: "Ver mixes" })).toHaveAttribute(
    "href",
    "/matches?kind=mix"
  )
})
