import { expect, test, type Page } from "@playwright/test"

// Header flotante de la landing. Ninguna de estas pruebas gasta logins ni registros.

/** Estas pruebas tratan sobre el tema, no sobre sus efectos (ver theme-fx.spec.ts). */
async function withoutThemeFx(page: Page) {
  await page.addInitScript(() => localStorage.setItem("csstv.themeFx", "off"))
}

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
    await withoutThemeFx(page)
    await page.goto("/")
    await expect(page.getByRole("group", { name: "Tema" })).toHaveCount(0)
    await page.getByRole("button", { name: "Abrir menú" }).click()
    await page.getByRole("menuitemradio", { name: "Oscuro" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    // El menú se cierra con una animación: reabrirlo antes de que termine es una carrera.
    await expect(page.getByRole("menu")).toBeHidden()

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
  await withoutThemeFx(page)
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

test("el pie muestra las banderas de Argentina y Colombia", async ({
  page,
}) => {
  await page.goto("/")
  const footer = page.getByRole("contentinfo")
  await expect(
    footer.getByRole("img", { name: "Bandera de Argentina" })
  ).toBeVisible()
  await expect(
    footer.getByRole("img", { name: "Bandera de Colombia" })
  ).toBeVisible()
})

// Estado simulado: el servidor real puede estar apagado y la prueba no puede depender de eso.
const SERVERS_STATUS = {
  servers: [
    {
      id: "a",
      name: "CM League #1",
      address: "45.235.98.57:27062",
      mode: "mix",
      region: "Argentina",
      online: true,
      ping_ms: 18,
      map: "de_mirage",
      players: 7,
      max_players: 12,
      bots: 1,
      live_matches: 1,
    },
    {
      id: "b",
      name: "CM League #2",
      address: null,
      mode: null,
      region: null,
      online: false,
      ping_ms: null,
      map: null,
      players: null,
      max_players: null,
      bots: null,
      live_matches: 0,
    },
  ],
  totals: { servers: 2, online: 1, players: 7, live_matches: 1 },
  checked_at: "2026-10-19T12:00:00Z",
}

test("servidores y pill del hero con el estado real de la API", async ({
  page,
  context,
}) => {
  await page.route("**/api/v1/servers/status", (route) =>
    route.fulfill({ json: SERVERS_STATUS })
  )
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/")

  await expect(
    page.getByText("1 partida en vivo · 7 jugadores en el servidor")
  ).toBeVisible()

  const section = page.locator("#servidores")
  await expect(section.getByText("1/2", { exact: true })).toBeVisible()
  await expect(section.getByText("servidores en línea")).toBeVisible()

  const table = section.getByRole("table", { name: "Servidores" })
  await expect(
    table.getByRole("columnheader", { name: /Latencia/ })
  ).toBeVisible()
  const rows = table.getByRole("row")
  // Encabezado + 2 servidores.
  await expect(rows).toHaveCount(3)

  const online = rows.nth(1)
  await expect(online).toContainText("CM League #1")
  await expect(online).toContainText("Mix · Argentina · 45.235.98.57:27062")
  await expect(online).toContainText("de_mirage")
  await expect(online).toContainText("7/12")
  await expect(online).toContainText("18 ms")
  await expect(online.getByRole("link", { name: "Conectar" })).toHaveAttribute(
    "href",
    "steam://connect/45.235.98.57:27062"
  )
  await online.getByRole("button", { name: "45.235.98.57:27062" }).click()
  await expect(page.getByText("IP copiada")).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "connect 45.235.98.57:27062"
  )

  // Sin respuesta y sin IP: guiones y "Offline" deshabilitado.
  const offline = rows.nth(2)
  await expect(offline).toContainText("CM League #2")
  await expect(offline.getByRole("button", { name: "Offline" })).toBeDisabled()
  await expect(offline.getByRole("cell").nth(3)).toHaveText("—")
})

/** Imágenes visibles de la marca dentro de un contenedor, con su tamaño cargado. */
async function visibleBrandImages(page: Page, container: string) {
  return page.locator(`${container} img`).evaluateAll((imgs) =>
    imgs
      .filter((i) => (i as HTMLElement).offsetParent !== null)
      .map((i) => {
        const img = i as HTMLImageElement
        return { src: img.src, width: img.naturalWidth }
      })
  )
}

for (const scheme of ["light", "dark"] as const) {
  test(`marca CM League en el header (${scheme === "light" ? "claro" : "oscuro"}) y favicon`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await withoutThemeFx(page)
    await page.goto("/")
    await expect(page).toHaveTitle(/^CM League · /)
    await expect(
      page.getByRole("button", { name: "CM League, volver arriba" })
    ).toBeVisible()

    // Se ve una sola versión del lockup, la que corresponde al tema, y está cargada.
    await expect
      .poll(async () => (await visibleBrandImages(page, "header")).length)
      .toBe(1)
    const [lockup] = await visibleBrandImages(page, "header")
    expect(lockup.src).toContain(
      scheme === "light"
        ? "cmleague-lockup-color-fondo-claro"
        : "cmleague-lockup-color-fondo-oscuro"
    )
    expect(lockup.width).toBeGreaterThan(0)

    // Favicon: SVG, .ico y el ícono de iPhone, todos servidos.
    for (const href of [
      "/favicon.svg",
      "/favicon.ico",
      "/apple-touch-icon.png",
    ]) {
      await expect(page.locator(`head link[href="${href}"]`)).toHaveCount(1)
      expect((await page.request.get(href)).ok()).toBe(true)
    }
  })
}

test("en el teléfono angosto el header muestra solo el isotipo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await withoutThemeFx(page)
  await page.goto("/")
  await expect
    .poll(async () => (await visibleBrandImages(page, "header")).length)
    .toBe(1)
  const [mark] = await visibleBrandImages(page, "header")
  expect(mark.src).not.toContain("lockup")
  expect(mark.width).toBeGreaterThan(0)
})
