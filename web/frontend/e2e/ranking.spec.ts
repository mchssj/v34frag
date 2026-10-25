import { expect, test } from "@playwright/test"

import { USER_STATE } from "./helpers"

// Ranking contra la API local (copia de producción con la temporada BETA abierta). Solo lee.
test.use({ storageState: USER_STATE })

test("jugadores: temporada activa por defecto, Histórico, nivel, orden y perfil", async ({
  page,
}) => {
  await page.goto("/ranking")
  await expect(page.getByRole("heading", { name: "Ranking" })).toBeVisible()
  await expect(page.getByText("EN CURSO", { exact: true })).toBeVisible()
  await expect(page.getByText(/^Termina en/)).toBeVisible()
  await expect(page.getByRole("list", { name: "Podio" })).toBeVisible()
  await expect(
    page.getByRole("columnheader", { name: "Medalla si cierra hoy" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Solo con puesto" }).click()
  await expect(page).toHaveURL(/eligible=true/)
  await expect(page.getByText(/^\d+\/\d+$/)).toHaveCount(0)

  // Histórico: el ranking general del handoff.
  await page.getByRole("combobox", { name: "Temporada" }).click()
  await page.getByRole("option", { name: "Histórico" }).click()
  await expect(page).toHaveURL(/season=all/)
  await expect(page).not.toHaveURL(/eligible/)
  await expect(
    page.getByRole("columnheader", { name: "Últimos 30" })
  ).toBeVisible()

  const podium = page.getByRole("list", { name: "Podio" })
  const first = await podium.getByRole("link").first().textContent()
  await page.getByRole("button", { name: "Nivel 1–6" }).click()
  await expect(page).toHaveURL(/level=1-6/)
  // El podio no cambia con los filtros.
  await expect(podium.getByRole("link").first()).toHaveText(first ?? "")

  await page.getByRole("button", { name: "Ordenar por K/D" }).click()
  await expect(page).toHaveURL(/sort=kd/)

  const row = page.locator("tbody tr[role=link]").first()
  const alias = await row.getAttribute("aria-label")
  await row.click()
  await expect(page).toHaveURL(new RegExp(`/player/${alias}$`))
})

test("equipos: PCW cambia el subtítulo y la leyenda", async ({ page }) => {
  await page.goto("/ranking/teams")
  await expect(
    page.getByText("Puntos por partida de torneo ganada.")
  ).toBeVisible()
  await expect(
    page.getByText(/\d+ pts por partida de torneo ganada$/)
  ).toBeVisible()

  await page.getByRole("switch").click()
  await expect(page).toHaveURL(/pcw=true/)
  await expect(
    page.getByText(
      "Puntos por partida ganada en torneos y en PCW jugadas como equipo oficial."
    )
  ).toBeVisible()
  await expect(
    page.getByText(/pts por PCW ganada como equipo oficial/)
  ).toBeVisible()

  await page.getByRole("link", { name: "Jugadores" }).click()
  await expect(page).toHaveURL(/\/ranking$/)
})

test("comparador: dos jugadores reales", async ({ page }) => {
  await page.goto("/ranking?season=all")
  const links = page.getByRole("list", { name: "Podio" }).getByRole("link")
  await expect(links.first()).toBeVisible()
  const aliases = await links.allTextContents()
  test.skip(aliases.length < 3, "Hacen falta tres jugadores con ELO")

  await page.goto(`/players/compare?a=${aliases[0]}&b=${aliases[1]}`)
  await expect(
    page.getByRole("heading", { name: "Comparar jugadores" })
  ).toBeVisible()
  await expect(page.getByText("ELO en los últimos 30 mixes")).toBeVisible()
  await expect(page.getByText(/^Mixes jugados juntos:/)).toBeVisible()
  await expect(page.getByText(/^Como rivales:/)).toBeVisible()

  // El combobox busca y cambia B.
  await page.getByRole("combobox", { name: "Jugador B" }).click()
  await page.getByPlaceholder("Buscar por alias").fill(aliases[2])
  const option = page.getByRole("option").first()
  await expect(option).toBeVisible()
  await option.click()
  await expect(page).toHaveURL(/b=/)
})
