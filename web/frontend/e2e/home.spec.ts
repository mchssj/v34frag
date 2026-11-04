import { expect, test } from "@playwright/test"

import { USER_STATE } from "./helpers"

// "Para ti" contra la API local. La cuenta compartida de las pruebas no tiene jugador vinculado.
test.use({ storageState: USER_STATE })

test("Para ti: saludo, nivel sin vincular, pendientes, jugar y rankings", async ({
  page,
}) => {
  await page.goto("/home")
  await expect(
    page.getByRole("heading", { level: 1, name: /^Buen(os|as) / })
  ).toBeVisible()

  // Sin jugador vinculado, la tarjeta de nivel invita a vincular.
  const level = page.getByRole("region", { name: "Tu nivel" })
  await expect(level.getByText("Todavía no tienes nivel")).toBeVisible()
  await expect(level.getByRole("link", { name: "Vincular" })).toHaveAttribute(
    "href",
    "/profile/link"
  )

  // Pendientes: con algo que hacer o "Todo al día".
  const pending = page.getByRole("region", { name: "Pendientes" })
  await expect(pending).toBeVisible()
  await expect(
    pending.getByRole("listitem").first().or(pending.getByText("Todo al día"))
  ).toBeVisible()

  // La tarjeta de Jugar refleja el matchmaking.
  await expect(page.getByRole("region", { name: "Jugar" })).toBeVisible()

  // Rankings del costado: top 5 de jugadores y equipos, con links.
  const top = page.getByRole("region", { name: "Top jugadores" })
  await expect(top.getByRole("listitem")).toHaveCount(5)
  await expect(
    page
      .getByRole("region", { name: "Ranking de equipos" })
      .getByRole("listitem")
      .first()
      .getByRole("link")
  ).toHaveAttribute("href", /^\/teams\//)

  // "Jugar" de la cabecera de la página lleva al matchmaking.
  await page
    .getByRole("main")
    .getByRole("link", { name: "Jugar", exact: true })
    .click()
  await expect(page).toHaveURL(/\/play$/)
})
