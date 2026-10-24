import { expect, test, type Page } from "@playwright/test"

import { USER_STATE } from "./helpers"

// Shell de la app con sesión. Usa la sesión compartida: no gasta logins.
test.use({ storageState: USER_STATE })

const sidebar = (page: Page) => page.locator('[data-slot="sidebar"]').first()
const crumbs = (page: Page) =>
  page.getByRole("navigation", { name: "breadcrumb" })
const sidebarState = (page: Page) =>
  page.locator('[data-slot="sidebar"][data-state]').getAttribute("data-state")

test("el shell marca la página activa y los breadcrumbs siguen la navegación", async ({
  page,
}) => {
  await page.goto("/home")
  const paraTi = sidebar(page).getByRole("link", { name: "Para ti" })
  await expect(paraTi).toHaveAttribute("data-active", "true")
  await expect(crumbs(page)).toContainText("Para ti")

  await sidebar(page).getByRole("link", { name: "Partidas" }).click()
  await expect(page).toHaveURL(/\/matches$/)
  await expect(page.getByRole("heading", { name: "Partidas" })).toBeVisible()
  await expect(
    sidebar(page).getByRole("link", { name: "Partidas" })
  ).toHaveAttribute("data-active", "true")

  // Las fichas de jugador marcan Ranking y muestran el nick en el breadcrumb.
  await page.goto("/player/Zeta")
  await expect(
    sidebar(page).getByRole("link", { name: "Ranking" })
  ).toHaveAttribute("data-active", "true")
  await expect(
    crumbs(page).getByRole("link", { name: "Ranking" })
  ).toBeVisible()
  await expect(crumbs(page)).toContainText("Zeta")
})

test("el sidebar se colapsa y recuerda el estado al recargar", async ({
  page,
}) => {
  await page.goto("/home")
  expect(await sidebarState(page)).toBe("expanded")
  await page
    .getByRole("button", { name: "Mostrar u ocultar el menú" })
    .first()
    .click()
  await expect.poll(() => sidebarState(page)).toBe("collapsed")
  await page.reload()
  await expect.poll(() => sidebarState(page)).toBe("collapsed")
})

test("⌘K busca páginas y navega con el teclado", async ({ page }) => {
  await page.goto("/home")
  // El atajo se escucha cuando el shell ya está montado.
  await expect(page.getByText(/^Hola,/)).toBeVisible()
  await page.keyboard.press("Control+k")
  const dialog = page.getByRole("dialog", { name: "Buscar" })
  await expect(dialog).toBeVisible()
  await page.keyboard.type("zzz")
  await expect(dialog.getByText("Sin resultados para “zzz”.")).toBeVisible()
  await page.keyboard.press("Control+a")
  await page.keyboard.type("palm")
  await expect(dialog.getByRole("option", { name: /Palmarés/ })).toBeVisible()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/hall-of-fame$/)
  await expect(dialog).toBeHidden()
})

test("el tema se cambia desde la topbar", async ({ page }) => {
  await page.goto("/home")
  await page.getByRole("button", { name: /^Tema:/ }).click()
  await page.getByRole("menuitemradio", { name: "Oscuro" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
})

test("notificaciones de ejemplo (desarrollo): aceptar una invitación", async ({
  page,
}) => {
  await page.goto("/home")
  await page.getByRole("button", { name: /^Notificaciones/ }).click()
  await expect(page.getByText("Invitación a Furia Sur")).toBeVisible()
  await page.getByRole("button", { name: "Aceptar" }).click()
  await expect(page.getByText("Aceptada", { exact: true })).toBeVisible()
  await expect(page.getByText("Invitación aceptada")).toBeVisible()
  // Era la única sin leer: ya no queda nada por marcar.
  await expect(
    page.getByRole("button", { name: "Marcar todo como leído" })
  ).toBeDisabled()
  await page.getByRole("tab", { name: /Sin leer/ }).click()
  await expect(page.getByText("Estás al día.")).toBeVisible()
})

test.describe("en el teléfono", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("el menú se abre como panel y se cierra al navegar", async ({
    page,
  }) => {
    await page.goto("/home")
    await expect(page.getByRole("link", { name: "Ranking" })).toBeHidden()
    await page
      .getByRole("button", { name: "Mostrar u ocultar el menú" })
      .click()
    const panel = page.getByRole("dialog", { name: "Menú" })
    await expect(panel).toBeVisible()
    await panel.getByRole("link", { name: "Ranking" }).click()
    await expect(page).toHaveURL(/\/ranking$/)
    await expect(panel).toBeHidden()
  })
})

test("el sidebar muestra la marca CM League: isotipo y wordmark, y al colapsar solo el isotipo", async ({
  page,
}) => {
  await page.goto("/home")
  const brand = sidebar(page)
    .getByRole("link", { name: "CM League, ir al inicio" })
    .first()
  await expect(brand).toBeVisible()
  const loaded = () =>
    brand
      .locator("img")
      .evaluateAll((imgs) =>
        imgs
          .filter((i) => (i as HTMLElement).offsetParent !== null)
          .map((i) => (i as HTMLImageElement).naturalWidth > 0)
      )
  // Isotipo + wordmark, una versión de cada uno según el tema, cargadas.
  await expect.poll(loaded).toEqual([true, true])

  await page.keyboard.press("Control+b")
  await expect.poll(() => sidebarState(page)).toBe("collapsed")
  await expect(brand).toBeVisible()
})
