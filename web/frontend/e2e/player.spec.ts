import { expect, test } from "@playwright/test"

import { USER_STATE } from "./helpers"

// Perfil público contra la API local (copia de producción). Solo lee.
test.use({ storageState: USER_STATE })

test("perfil de un jugador del ranking: resumen, pestañas y una partida", async ({
  page,
}) => {
  // Un jugador real: el primero del Histórico.
  await page.goto("/ranking?season=all")
  const first = page
    .getByRole("list", { name: "Podio" })
    .getByRole("link")
    .first()
  await expect(first).toBeVisible()
  const alias = (await first.textContent()) ?? ""
  await first.click()

  await expect(page).toHaveURL(
    new RegExp(`/player/${encodeURIComponent(alias)}$`)
  )
  await expect(page.getByRole("heading", { name: alias })).toBeVisible()
  await expect(page.getByText("Evolución de ELO")).toBeVisible()
  await expect(page.getByText("Mixes, PCW y torneos")).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" })
  ).toContainText(alias)

  await page.getByRole("button", { name: "10", exact: true }).click()
  await expect(page).toHaveURL(/range=10/)

  for (const [tab, text] of [
    ["Mapas", /mapas$/],
    ["Equipos", /altas y bajas de los rosters/],
    ["Temporadas", /temporada/i],
    ["Bio y palmarés", "Biografía"],
  ] as const) {
    await page.getByRole("tab", { name: tab }).click()
    await expect(
      page.getByRole("tabpanel").getByText(text).first()
    ).toBeVisible()
  }

  await page.getByRole("tab", { name: "Partidas" }).click()
  await expect(page).toHaveURL(/tab=partidas/)
  await page.getByRole("button", { name: "Mix", exact: true }).click()
  await expect(page).toHaveURL(/kind=mix/)
  const row = page.locator("tbody tr[role=link]").first()
  await expect(row).toBeVisible()
  await row.click()
  await expect(page).toHaveURL(/\/match\//)
})

test("un nick que no existe", async ({ page }) => {
  await page.goto("/player/no-existe-zzz")
  await expect(
    page.getByText("No existe un jugador con ese nick.")
  ).toBeVisible()
  await page.getByRole("link", { name: "Ver el ranking" }).click()
  await expect(page).toHaveURL(/\/ranking$/)
})
