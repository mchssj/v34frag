import { expect, test } from "@playwright/test"

import { API, USER_STATE } from "./helpers"

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
    ["Mapas", /mapas?$/],
    ["Equipos", /^Actuales|Todavía no estuvo en un equipo/],
    ["Temporadas", /temporada/i],
    ["Bio y torneos", "Palmarés"],
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

test("pestañas: contadores, mapas sin partidas en cero, vacío con filtros y vitrina", async ({
  page,
}) => {
  // juanma (copia local): 7 mapas jugados, una medalla y ningún torneo.
  await page.goto("/player/juanma")
  const tabs = page.getByRole("tablist", { name: "Secciones del perfil" })
  await expect(tabs.getByRole("tab", { name: "Mapas" })).toHaveText(
    /^Mapas\d+$/
  )
  await expect(tabs.getByRole("tab", { name: "Partidas" })).toHaveText(
    /^Partidas\d+$/
  )

  await tabs.getByRole("tab", { name: "Mapas" }).click()
  const panel = page.getByRole("tabpanel")
  // Los mapas del catálogo que no jugó: en cero y atenuados.
  await expect(panel.getByText("Sin partidas").first()).toBeVisible()
  await expect(panel.getByText("mirage_rc1")).toBeVisible()

  // Sin resultados con esos filtros: lo dice y ofrece quitarlos.
  await page.goto("/player/juanma?tab=partidas&kind=official&result=won")
  await expect(
    panel.getByText("Ninguna partida con esos filtros")
  ).toBeVisible()
  await panel.getByRole("button", { name: "Quitar filtros" }).click()
  await expect(page).not.toHaveURL(/kind=/)
  await expect(page.locator("tbody tr[role=link]").first()).toBeVisible()

  await tabs.getByRole("tab", { name: "Bio y torneos" }).click()
  const palmares = page.getByRole("region", { name: "Palmarés" })
  await expect(palmares.getByText("Medallas")).toBeVisible()
  // Sin títulos de torneo, ese bloque no aparece.
  await expect(palmares.getByText("Torneos")).toHaveCount(0)
})

test("Equipos muestra el logo del equipo aunque el historial no lo traiga", async ({
  page,
}) => {
  // Un equipo real con logo y uno de sus integrantes.
  const { items } = await (
    await page.request.get(`${API}/api/v1/teams?per=100`)
  ).json()
  const team = (items as { id: string; logo_url: string | null }[]).find(
    (t) => t.logo_url
  )
  test.skip(!team, "La base local no tiene equipos con logo")
  const members = await (
    await page.request.get(`${API}/api/v1/teams/${team!.id}/members`)
  ).json()
  const alias = (members.items ?? members)[0].alias as string

  await page.goto(`/player/${encodeURIComponent(alias)}?tab=equipos`)
  await expect(
    page.getByRole("tabpanel").locator(`img[src="${team!.logo_url}"]`)
  ).toBeVisible()
})

test("cambiar de pestaña no mueve el scroll", async ({ page }) => {
  const { items } = await (
    await page.request.get(`${API}/api/v1/players?limit=1`)
  ).json()
  await page.goto(`/player/${encodeURIComponent(items[0].alias)}`)
  const tabs = page.getByRole("tablist", { name: "Secciones del perfil" })
  await expect(tabs).toBeVisible()
  // Las pestañas quedan arriba de la pantalla, como al leer el perfil.
  await tabs.evaluate((el) =>
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 80)
  )
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBeGreaterThan(100)

  for (const tab of ["Partidas", "Mapas", "Resumen"]) {
    await tabs.getByRole("tab", { name: tab }).click()
    await expect(tabs.getByRole("tab", { name: tab })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before)
  }
})

test("un nick que no existe", async ({ page }) => {
  await page.goto("/player/no-existe-zzz")
  await expect(
    page.getByText("No existe un jugador con ese nick.")
  ).toBeVisible()
  await page.getByRole("link", { name: "Ver el ranking" }).click()
  await expect(page).toHaveURL(/\/ranking$/)
})
