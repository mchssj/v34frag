import { expect, test } from "@playwright/test"

// Header flotante de la landing. Ninguna de estas pruebas gasta logins ni registros.

test.describe("menú del header en el teléfono", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("lleva a la sección elegida y se cierra; Escape también lo cierra", async ({
    page,
  }) => {
    await page.goto("/")
    await expect(
      page.getByRole("navigation", { name: "Secciones" })
    ).toBeHidden()

    await page.getByRole("button", { name: "Abrir menú" }).click()
    await page.getByRole("menuitem", { name: "Servidores" }).click()
    await expect(page.getByRole("menu")).toBeHidden()
    await expect(
      page.getByRole("heading", { name: "Entra a jugar ahora." })
    ).toBeInViewport()

    await page.getByRole("button", { name: "Abrir menú" }).click()
    await expect(page.getByRole("menu")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("menu")).toBeHidden()
  })

  test("en pantallas angostas el tema e 'Iniciar sesión' están en el menú", async ({
    page,
  }) => {
    await page.goto("/")
    await expect(page.getByRole("group", { name: "Tema" })).toHaveCount(0)
    await page.getByRole("button", { name: "Abrir menú" }).click()
    await page.getByRole("menuitemradio", { name: "Oscuro" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)

    await page.getByRole("button", { name: "Abrir menú" }).click()
    await page.getByRole("menuitem", { name: "Iniciar sesión" }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test("al agrandar la ventana a 1000px o más el menú se cierra y no vuelve a abrirse solo", async ({
    page,
  }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Abrir menú" }).click()
    await expect(page.getByRole("menu")).toBeVisible()

    await page.setViewportSize({ width: 1200, height: 844 })
    await expect(page.getByRole("menu")).toBeHidden()
    await expect(
      page.getByRole("navigation", { name: "Secciones" })
    ).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole("menu")).toBeHidden()
  })
})

test("en escritorio el tema elegido persiste al recargar", async ({ page }) => {
  await page.goto("/")
  const theme = page.getByRole("group", { name: "Tema" })
  await expect(theme.getByRole("button", { name: "Sistema" })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await theme.getByRole("button", { name: "Oscuro" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)

  await page.reload()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(
    page
      .getByRole("group", { name: "Tema" })
      .getByRole("button", { name: "Oscuro" })
  ).toHaveAttribute("aria-pressed", "true")
})
