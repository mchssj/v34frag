import { expect, test, type Page } from "@playwright/test"

import { API, USER_STATE } from "./helpers"

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

test("el menú de cuenta: perfil público, cuenta, tema y cerrar sesión", async ({
  page,
}) => {
  // La cuenta compartida no tiene jugador: se simula vinculada a una ficha real.
  const { items } = await (
    await page.request.get(`${API}/api/v1/players?limit=1`)
  ).json()
  const { id, alias } = items[0] as { id: string; alias: string }
  await page.route("**/api/v1/me/profile", async (route) => {
    const profile = await (await route.fetch()).json()
    await route.fulfill({
      json: {
        ...profile,
        player: { id, nick: alias, photo_url: null, steam_id: null },
      },
    })
  })
  await page.goto("/home")
  const account = sidebar(page).getByRole("button", {
    name: /^Menú de cuenta/,
  })
  await account.click()
  await page.getByRole("menuitem", { name: "Ver perfil público" }).click()
  await expect(page).toHaveURL(new RegExp(`/player/${alias}$`))
  // En la ficha propia el pie queda marcado, y desde ahí se edita.
  await expect(account).toHaveAttribute("data-active", "true")
  await page.getByRole("link", { name: "Editar perfil" }).click()
  await expect(page).toHaveURL(/\/profile$/)

  // El tema se cambia sin cerrar el menú.
  await account.click()
  await page.getByRole("menuitemradio", { name: "Oscuro" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.getByRole("menuitem", { name: "Cuenta" }).click()
  await expect(page).toHaveURL(/\/profile\/account$/)

  // Cerrar sesión pide confirmación; Cancelar no sale.
  await account.click()
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click()
  const confirm = page.getByRole("dialog", { name: "¿Cerrar sesión?" })
  await confirm.getByRole("button", { name: "Cancelar" }).click()
  await expect(confirm).toBeHidden()
  await expect(page).toHaveURL(/\/profile\/account$/)
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

  // Cerrar sesión también está en ⌘K, con la misma confirmación.
  await page.keyboard.press("Control+k")
  await expect(dialog).toBeVisible()
  await page.keyboard.type("cerrar")
  await expect(
    dialog.getByRole("option", { name: "Cerrar sesión" })
  ).toBeVisible()
  await page.keyboard.press("Enter")
  const confirm = page.getByRole("dialog", { name: "¿Cerrar sesión?" })
  await expect(confirm).toBeVisible()
  await confirm.getByRole("button", { name: "Cancelar" }).click()
  await expect(page).toHaveURL(/\/hall-of-fame$/)
})

test("el tema se cambia desde la topbar", async ({ page }) => {
  await page.goto("/home")
  await page.getByRole("button", { name: /^Tema:/ }).click()
  await page.getByRole("menuitemradio", { name: "Oscuro" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
})

test("la campana lee las notificaciones de la API y Preferencias guarda las categorías", async ({
  page,
}) => {
  // La cuenta compartida es nueva en cada corrida: todavía no tiene notificaciones.
  await page.goto("/home")
  await page.getByRole("button", { name: /^Notificaciones/ }).click()
  await expect(page.getByText("Estás al día.")).toBeVisible()
  await page.keyboard.press("Escape")

  await page.goto("/profile/preferences")
  const news = page.getByRole("switch", { name: /Novedades/ })
  await expect(news).not.toBeChecked()
  await news.click()
  await expect(page.getByText("Preferencia guardada")).toBeVisible()
  await page.reload()
  await expect(page.getByRole("switch", { name: /Novedades/ })).toBeChecked()
  await page.getByRole("switch", { name: /Novedades/ }).click()
  await expect(
    page.getByRole("switch", { name: /Novedades/ })
  ).not.toBeChecked()
  // Un usuario común no ve la categoría de Administración.
  await expect(
    page.getByRole("switch", { name: /Administración/ })
  ).toHaveCount(0)
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
