import { expect, test, type Page } from "@playwright/test"

// Efectos de cambio de tema de la landing. No gastan logins ni registros.

const FX_KEY = "csstv.themeFx"

const themeGroup = (page: Page) => page.getByRole("group", { name: "Tema" })
const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"))
const readPref = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), FX_KEY)

/** Deja una preferencia guardada antes de cargar la página. */
async function withPref(page: Page, value: string) {
  await page.addInitScript(
    ([key, v]) => localStorage.setItem(key, v),
    [FX_KEY, value]
  )
}

test.describe("en claro", () => {
  test.use({ colorScheme: "light" })

  test("el primer cambio con efecto pregunta; Escape aplica el tema sin guardar nada", async ({
    page,
  }) => {
    await page.goto("/")
    await themeGroup(page).getByRole("button", { name: "Oscuro" }).click()
    const dialog = page.getByRole("dialog", {
      name: "Efectos al cambiar de tema",
    })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole("button", { name: "Activar efectos" })
    ).toBeFocused()
    await expect(dialog.getByRole("note")).toContainText(
      "Aviso de fotosensibilidad"
    )
    // Con mouse, solo el atajo de clic derecho.
    await expect(dialog.getByText("Clic derecho")).toBeVisible()
    await expect(dialog.getByText("Mantén presionado")).toHaveCount(0)
    expect(await isDark(page)).toBe(false)

    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect.poll(() => isDark(page)).toBe(true)
    expect(await readPref(page)).toBeNull()
  })

  test("con 'Sin sonido' guardado, pasar a oscuro lanza la smoke y cambia el tema", async ({
    page,
  }) => {
    await withPref(page, "silent")
    await page.goto("/")
    await themeGroup(page).getByRole("button", { name: "Oscuro" }).click()
    const smoke = page.locator("canvas[data-theme-fx=smoke]")
    await expect(smoke).toBeAttached()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect.poll(() => isDark(page)).toBe(true)
    await expect(smoke).toHaveCount(0, { timeout: 5000 })
  })

  test("con efectos desactivados el cambio es directo", async ({ page }) => {
    await withPref(page, "off")
    await page.goto("/")
    await themeGroup(page).getByRole("button", { name: "Oscuro" }).click()
    expect(await isDark(page)).toBe(true)
    await expect(page.locator("[data-theme-fx]")).toHaveCount(0)
  })

  test("el clic derecho sobre el selector cambia la preferencia", async ({
    page,
  }) => {
    await page.goto("/")
    await themeGroup(page).click({ button: "right" })
    const menu = page.getByRole("menu")
    await expect(menu.getByText("Efectos de tema")).toBeVisible()
    // Sin preferencia guardada se marca "Con sonido".
    await expect(
      menu.getByRole("menuitemradio", { name: "Con sonido" })
    ).toHaveAttribute("aria-checked", "true")
    await menu.getByRole("menuitemradio", { name: "Desactivados" }).click()
    await expect(menu).toBeHidden()
    expect(await readPref(page)).toBe("off")
  })
})

test.describe("en oscuro", () => {
  test.use({ colorScheme: "dark" })

  test("'Activar efectos' guarda la preferencia y lanza la flashbang", async ({
    page,
  }) => {
    await page.goto("/")
    await themeGroup(page).getByRole("button", { name: "Claro" }).click()
    await page.getByRole("button", { name: "Activar efectos" }).click()
    expect(await readPref(page)).toBe("full")

    const flash = page.locator("div[data-theme-fx=flashbang]")
    await expect(flash).toBeAttached()
    // El tema cambia en el pico blanco (0,9 s) y el efecto se limpia a los 4,5 s.
    await expect.poll(() => isDark(page)).toBe(false)
    await expect(flash).toHaveCount(0, { timeout: 6000 })
    expect(await page.evaluate(() => document.body.style.filter)).toBe("")
  })
})

test.describe("con movimiento reducido", () => {
  test.use({ colorScheme: "light", reducedMotion: "reduce" })

  test("nunca pregunta ni lanza efectos", async ({ page }) => {
    await page.goto("/")
    await themeGroup(page).getByRole("button", { name: "Oscuro" }).click()
    expect(await isDark(page)).toBe(true)
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.locator("[data-theme-fx]")).toHaveCount(0)
  })
})

test.describe("en el teléfono", () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: "light" })

  test("el menú tiene 'Efectos de tema' y elegir el tema también pregunta", async ({
    page,
  }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Abrir menú" }).click()
    await expect(
      page.getByRole("menu").getByText("Efectos de tema")
    ).toBeVisible()
    await page.getByRole("menuitemradio", { name: "Sin sonido" }).click()
    expect(await readPref(page)).toBe("silent")
    await expect(page.getByRole("menu")).toBeHidden()

    // Con la preferencia guardada no hay modal: va directo a la smoke.
    await page.getByRole("button", { name: "Abrir menú" }).click()
    await page.getByRole("menuitemradio", { name: "Oscuro" }).click()
    await expect(page.locator("canvas[data-theme-fx=smoke]")).toBeAttached()
    await expect.poll(() => isDark(page)).toBe(true)
  })

  test("sin preferencia, elegir Oscuro en el menú abre el modal", async ({
    page,
  }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Abrir menú" }).click()
    await page.getByRole("menuitemradio", { name: "Oscuro" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Activar efectos" })
    ).toBeFocused()
  })
})

test.describe("pantalla táctil", () => {
  test.use({ colorScheme: "light", hasTouch: true })

  test("el modal muestra el atajo de pulsación larga", async ({ page }) => {
    await page.goto("/")
    await themeGroup(page).getByRole("button", { name: "Oscuro" }).tap()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText("Mantén presionado")).toBeVisible()
  })

  test("la pulsación larga abre el menú de efectos sin cambiar el tema", async ({
    page,
  }) => {
    await page.goto("/")
    const button = themeGroup(page).getByRole("button", { name: "Oscuro" })
    const box = (await button.boundingBox())!
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const cdp = await page.context().newCDPSession(page)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point],
    })
    await page.waitForTimeout(900)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    })
    await expect(
      page.getByRole("menu").getByText("Efectos de tema")
    ).toBeVisible()
    await page.waitForTimeout(300)
    expect(await isDark(page)).toBe(false)
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })
})
