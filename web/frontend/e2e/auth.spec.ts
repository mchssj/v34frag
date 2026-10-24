import { readFileSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"

import {
  API,
  PASSWORD,
  STORAGE_KEY,
  USER_INFO,
  USER_STATE,
  expectHome,
  login,
  logout,
  readSession,
  skipWelcome,
  uniqueUser,
  zoomIn,
} from "./helpers"
import { spendAuth } from "./authBudget"

// Login y registro cuentan para el límite de 10 por minuto (spendAuth espera si hace falta): cada
// prueba anota cuántos gasta.
const main = () =>
  JSON.parse(readFileSync(USER_INFO, "utf8")) as {
    email: string
    alias: string
    id: string
  }

const HOME = "http://localhost:5173/home"

async function registerUntilAlias(page: Page, email: string) {
  await page.goto("/register")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Contraseña").fill(PASSWORD)
  await page.getByRole("button", { name: "Continuar" }).click()
  await expect(page.getByText("Paso 2 de 3 · Alias")).toBeVisible()
}

test.describe("sin sesión", () => {
  test("la landing se ve enseguida para un visitante", async ({ page }) => {
    await page.goto("/")
    await expect(
      page.getByRole("heading", { name: /La liga competitiva de/ })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Iniciar sesión" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Crear cuenta", exact: true })
    ).toBeVisible()
  })

  test("el link de confirmación del email no deja los tokens en la URL", async ({
    page,
  }) => {
    await page.goto(
      "/#access_token=falso&refresh_token=falso&expires_at=1&type=signup"
    )
    await expect(page).toHaveURL(/\/login\?aviso=cuenta-confirmada$/)
    await expect(page.getByText("Tu cuenta quedó confirmada")).toBeVisible()
    expect(page.url()).not.toContain("access_token")
  })

  test("una sesión muerta en una página pública deja ver la página como visitante", async ({
    page,
  }) => {
    // Tokens inválidos y vencidos: la renovación falla y la landing sigue funcionando.
    await page.addInitScript(
      ([key]) => {
        if (!sessionStorage.getItem("e2e-sembrado")) {
          sessionStorage.setItem("e2e-sembrado", "1")
          localStorage.setItem(
            key,
            JSON.stringify({
              accessToken: "x",
              refreshToken: "y",
              expiresAt: Date.now() - 1000,
            })
          )
        }
      },
      [STORAGE_KEY]
    )
    await page.goto("/")
    await expect(
      page.getByRole("link", { name: "Iniciar sesión" })
    ).toBeVisible()
    await expect.poll(() => readSession(page)).toBeNull()
  })

  test("el alias tomado se avisa mientras se escribe", async ({ page }) => {
    await registerUntilAlias(page, uniqueUser().email)
    await page
      .getByLabel("Alias", { exact: true })
      .fill(main().alias.toUpperCase())
    await expect(page.getByText("En uso")).toBeVisible()
  })
})

test("registro → Bienvenida → aviso del Home (1 registro)", async ({
  page,
  request,
}) => {
  // El connect sale del estado de los servidores: uno de mix en línea (simulado, para no depender del real).
  await page.route("**/api/v1/servers/status", (route) =>
    route.fulfill({
      json: {
        servers: [
          {
            id: "dm",
            name: "DM",
            address: "10.0.0.2:27015",
            mode: "deathmatch",
            region: null,
            online: true,
            ping_ms: 9,
            map: "de_dust2",
            players: 3,
            max_players: 16,
            bots: 0,
            live_matches: 0,
          },
          {
            id: "mix",
            name: "Mix",
            address: "10.0.0.1:27015",
            mode: "mix",
            region: null,
            online: true,
            ping_ms: 9,
            map: "de_inferno",
            players: 8,
            max_players: 12,
            bots: 0,
            live_matches: 1,
          },
        ],
        totals: { servers: 2, online: 2, players: 11, live_matches: 1 },
        checked_at: "2026-10-19T12:00:00Z",
      },
    })
  )
  const user = uniqueUser()
  await registerUntilAlias(page, user.email)
  await page.getByLabel("Alias", { exact: true }).fill(user.alias)
  await expect(page.getByText("Disponible")).toBeVisible()
  await spendAuth()
  await page.getByRole("button", { name: "Crear cuenta" }).click()

  // La Supabase local no pide confirmar el email: sigue directo a la Bienvenida.
  await expect(page).toHaveURL(/\/welcome$/)
  // Paso 1: foto (recortada y subida al elegirla) y nombre.
  await expect(
    page.getByText("Completa tu perfil · paso 1 de 4 · Foto y nombre")
  ).toBeVisible()
  await expect(
    page.getByText(`Email confirmado · hola, ${user.alias}`)
  ).toBeVisible()
  await page
    .locator('input[type="file"]')
    .setInputFiles("src/assets/landing-bg.webp")
  // Encuadre antes de subir: zoom y guardar.
  const crop = page.getByRole("dialog", { name: "Encuadra tu foto" })
  await expect(crop).toBeVisible()
  await zoomIn(crop)
  await crop.getByRole("button", { name: "Guardar foto" }).click()
  await expect(crop).toBeHidden()
  await expect(
    page.getByRole("button", { name: "Elegir foto de perfil" }).locator("img")
  ).toBeVisible()
  await page.getByLabel(/^Nombre real/).fill("Martín Ruiz")
  await expect(
    page.getByText("Martín Ruiz · visible para admins y capitanes")
  ).toBeVisible()
  await page.getByRole("button", { name: "Guardar y seguir" }).click()

  // Paso 2: estilo de juego.
  await expect(
    page.getByText("Completa tu perfil · paso 2 de 4 · Estilo de juego")
  ).toBeVisible()
  await page.getByText("AWPer", { exact: true }).click()
  await page.getByLabel("País").click()
  await page.getByRole("option", { name: "Chile" }).click()
  await page.getByRole("button", { name: "Guardar y seguir" }).click()

  // Paso 3: contactos (Discord se normaliza: sin #1234 y en minúsculas).
  await expect(
    page.getByText("Completa tu perfil · paso 3 de 4 · Contactos")
  ).toBeVisible()
  await page.getByLabel("Discord").fill("Zeta.CS#1234")
  await page.getByRole("button", { name: "Guardar y seguir" }).click()

  await expect(
    page.getByText("Completa tu perfil · paso 4 de 4 · Vinculación")
  ).toBeVisible()
  const code = await page.getByLabel(/^Código /).getAttribute("aria-label")
  expect(code).toMatch(/^Código [A-Z0-9]{6}$/)
  await expect(page.getByText("connect 10.0.0.1:27015")).toBeVisible()
  await page.getByRole("button", { name: "Lo hago después" }).click()

  await expectHome(page, user.alias)
  await expect(page.getByText("Completa tu perfil · 3 de 4")).toBeVisible()

  const session = await readSession(page)
  const profile = await request.get(`${API}/api/v1/me/profile`, {
    headers: { Authorization: `Bearer ${session!.accessToken}` },
  })
  const details = (await profile.json()).details
  expect(details).toMatchObject({
    real_name: "Martín Ruiz",
    game_role: "AWPer",
    country: "Chile",
    discord: "zeta.cs",
  })
  expect(details.avatar_url).toBeTruthy()

  // Desde el aviso vuelve solo a lo que falta (la vinculación), con el mismo código (no gasta otro).
  await page.getByRole("link", { name: "Continuar" }).click()
  await expect(
    page.getByText("Completa tu perfil · paso 1 de 1 · Vinculación")
  ).toBeVisible()
  await expect(page.getByLabel(/^Código /)).toHaveAttribute("aria-label", code!)
})

test("login incorrecto y después un redirect malicioso termina en el inicio (2 logins)", async ({
  page,
}) => {
  await skipWelcome(page, main().id)
  await page.goto("/login?redirect=//evil.com")
  await page.getByLabel("Email").fill(main().email)
  await page.getByLabel("Contraseña").fill("incorrecta")
  await spendAuth()
  await page.getByRole("button", { name: "Iniciar sesión" }).click()
  await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible()

  await login(page, main().email)
  await expect(page).toHaveURL(HOME)
})

test("ruta protegida → login → Bienvenida → Saltar; recarga; logout (1 registro + 1 login)", async ({
  page,
}) => {
  const user = uniqueUser()
  await spendAuth()
  const res = await page.request.post(`${API}/auth/signup`, {
    data: { email: user.email, password: PASSWORD, tag: user.alias },
  })
  expect(res.status()).toBe(201)

  await page.goto("/home")
  await expect(page).toHaveURL(/\/login\?redirect=%2Fhome$/)
  await login(page, user.email)
  // Primer ingreso: la Bienvenida va antes del Home.
  await expect(page).toHaveURL(/\/welcome$/)
  await page.getByRole("button", { name: "Saltar por ahora" }).click()
  await expectHome(page, user.alias)
  await expect(page.getByText("Completa tu perfil · 0 de 4")).toBeVisible()

  await page.reload()
  await expectHome(page, user.alias)

  await logout(page)
  await expect(page).toHaveURL("http://localhost:5173/")
  await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible()
  expect(await readSession(page)).toBeNull()

  // El servidor revocó la sesión: el refresh token ya no sirve.
  await page.goto("/home")
  await expect(page).toHaveURL(/\/login/)
})

test("dos pestañas con Recordarme: el logout en una cierra la otra (1 login)", async ({
  context,
}) => {
  await skipWelcome(context, main().id)
  const a = await context.newPage()
  await a.goto("/login")
  await login(a, main().email)
  await expect(a).toHaveURL(HOME)

  const b = await context.newPage()
  await b.goto("/home")
  await expectHome(b, main().alias)

  await logout(a)
  await expect(b).toHaveURL(/\/login/)
})

test("sin Recordarme: otra pestaña recibe la sesión y al cerrar el navegador se pierde (1 login)", async ({
  browser,
}) => {
  const context = await browser.newContext()
  await skipWelcome(context, main().id)
  const a = await context.newPage()
  await a.goto("/login")
  await login(a, main().email, { remember: false })
  await expect(a).toHaveURL(HOME)
  expect(await readSession(a, "local")).toBeNull()
  expect(await readSession(a, "session")).not.toBeNull()

  // sessionStorage no se comparte: la pestaña nueva la pide por BroadcastChannel.
  const b = await context.newPage()
  await b.goto("/home")
  await expectHome(b, main().alias)

  // Un contexto nuevo con el mismo storage persistente equivale a reabrir el navegador.
  const state = await context.storageState()
  await context.close()
  const reopened = await browser.newContext({ storageState: state })
  const c = await reopened.newPage()
  await c.goto("/home")
  await expect(c).toHaveURL(/\/login/)
  await reopened.close()
})

test("token vencido: se renueva sin que se note (1 login)", async ({
  page,
}) => {
  await skipWelcome(page, main().id)
  await page.goto("/login")
  await login(page, main().email)
  await expect(page).toHaveURL(HOME)
  const before = await readSession(page)

  await page.evaluate(
    ([key]) => {
      const s = JSON.parse(localStorage.getItem(key)!)
      localStorage.setItem(
        key,
        JSON.stringify({ ...s, expiresAt: Date.now() - 1000 })
      )
    },
    [STORAGE_KEY]
  )
  await page.reload()
  await expectHome(page, main().alias)
  const after = await readSession(page)
  expect(after!.refreshToken).not.toBe(before!.refreshToken)
  expect(after!.expiresAt).toBeGreaterThan(Date.now())
})

test.describe("con la sesión compartida", () => {
  test.use({ storageState: USER_STATE })

  test("la landing con sesión va al Home", async ({ page }) => {
    await page.goto("/")
    await expectHome(page, main().alias)
  })

  test("un usuario común no ve Administración y si entra a /admin vuelve al inicio", async ({
    page,
  }) => {
    await page.goto("/admin/players")
    await expectHome(page, main().alias)
    await expect(
      page.getByRole("link", { name: "Usuarios y moderación" })
    ).toHaveCount(0)
  })

  test("con la API caída no manda al login: muestra el error", async ({
    page,
  }) => {
    await page.route(`${API}/**`, (route) => route.abort("connectionrefused"))
    await page.goto("/home")
    await expect(
      page.getByRole("heading", { name: "No se pudo conectar" })
    ).toBeVisible()
    await expect(page).toHaveURL(/\/home$/)
  })

  test("en las páginas de cuenta, con sesión, sale al Home", async ({
    page,
  }) => {
    await page.goto("/login")
    await expect(page).toHaveURL(HOME)
  })
})
