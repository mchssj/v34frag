import { expect, test } from "@playwright/test"

import { USER_STATE } from "./helpers"

// Mixes contra la API local (con los mixes de la base). Solo lee: no borra nada.
test.use({ storageState: USER_STATE })

test("listado: KPIs, filtros en la URL, paginación y sala de un mix terminado", async ({
  page,
}) => {
  await page.goto("/mixes")
  await expect(page.getByRole("heading", { name: "Mixes" })).toBeVisible()
  await expect(page.getByText("Jugadores en los últimos 30 días")).toBeVisible()
  await expect(page.getByText(/^Mostrando \d+–\d+ de \d+$/)).toBeVisible()

  const rows = page.getByRole("link", { name: / contra / })
  await expect(rows.first()).toBeVisible()

  await page.getByRole("button", { name: "Ocultar canceladas" }).click()
  await expect(page).toHaveURL(/hideCancel=true/)
  await expect(page.getByText(/^Cancelada · /)).toHaveCount(0)

  const next = page.getByRole("button", { name: "Página siguiente" })
  if (await next.isEnabled()) {
    await next.click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole("button", { name: "2" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  }

  // Una fila terminada abre su sala.
  await rows.first().click()
  await expect(page).toHaveURL(/\/match\//)
  await expect(page.getByText("FINAL")).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" })
  ).toContainText("Mixes")
  await expect(page.getByRole("columnheader", { name: "Δ ELO" })).toHaveCount(
    2
  )

  await page.getByRole("link", { name: "Volver" }).click()
  await expect(page).toHaveURL(/\/mixes/)
})

test("un mix en vivo que ya no existe muestra que terminó", async ({ page }) => {
  await page.goto("/mixes/live/no-existe")
  await expect(page.getByText("Este mix terminó.")).toBeVisible()
  await expect(page.getByRole("link", { name: "Ver mixes" })).toBeVisible()
})
