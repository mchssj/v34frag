import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"

import {
  API,
  PASSWORD,
  STORAGE_KEY,
  USER_INFO,
  USER_STATE,
  expectPanel,
  login,
  readSession,
  uniqueUser,
} from "./helpers"

// Login y registro cuentan para el límite de 10 por minuto: cada prueba anota cuántos gasta.
const main = () =>
  JSON.parse(readFileSync(USER_INFO, "utf8")) as {
    email: string
    alias: string
  }

test.describe("sin sesión", () => {
  test("la landing se ve enseguida para un visitante", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("link", { name: "Ingresar" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Crear cuenta" })).toBeVisible()
  })

  test("el link de confirmación del email no deja los tokens en la URL", async ({
    page,
  }) => {
    await page.goto(
      "/#access_token=falso&refresh_token=falso&expires_at=1&type=signup"
    )
    await expect(page).toHaveURL(/\/ingresar\?aviso=cuenta-confirmada$/)
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
    await expect(page.getByRole("link", { name: "Ingresar" })).toBeVisible()
    await expect.poll(() => readSession(page)).toBeNull()
  })

  test("el alias tomado se avisa mientras se escribe", async ({ page }) => {
    await page.goto("/registro")
    await page.getByLabel("Alias").fill(main().alias.toUpperCase())
    await expect(page.getByText("Ese alias ya está en uso.")).toBeVisible()
  })
})

test("registro completo con los pasos opcionales (1 registro)", async ({
  page,
  request,
}) => {
  const user = uniqueUser()
  await page.goto("/registro")
  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Contraseña").fill(PASSWORD)
  await page.getByLabel("Alias").fill(user.alias)
  await expect(page.getByText("Disponible")).toBeVisible()
  await page.getByRole("button", { name: "Crear cuenta" }).click()

  await expect(page).toHaveURL(/\/completar-perfil\?paso=datos$/)
  await page.getByLabel("Nombre real").fill("Tester Pérez")
  await page.getByLabel("País").click()
  await page.getByRole("option", { name: "Argentina" }).click()
  await page.getByRole("button", { name: "Guardar y seguir" }).click()

  await expect(page).toHaveURL(/paso=redes$/)
  await page.getByLabel("Discord").fill("tester_e2e")
  await page.getByRole("button", { name: "Guardar y seguir" }).click()

  await expect(page).toHaveURL(/paso=avatar$/)
  // PNG de 2×2 generado en memoria: el navegador lo recorta a 256×256 JPEG.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
    "base64"
  )
  await page
    .getByLabel("Imagen")
    .setInputFiles({ name: "a.png", mimeType: "image/png", buffer: png })
  await page.getByRole("button", { name: "Guardar y terminar" }).click()
  await expectPanel(page, user.alias)

  const session = await readSession(page)
  const profile = await request.get(`${API}/api/v1/me/profile`, {
    headers: { Authorization: `Bearer ${session!.accessToken}` },
  })
  const body = await profile.json()
  expect(body.details).toMatchObject({
    real_name: "Tester Pérez",
    country: "Argentina",
    discord: "tester_e2e",
  })
  expect(body.details.avatar_url).toBeTruthy()
})

test("login incorrecto y después un redirect malicioso termina en el inicio (2 logins)", async ({
  page,
}) => {
  await page.goto("/ingresar?redirect=//evil.com")
  await page.getByLabel("Email").fill(main().email)
  await page.getByLabel("Contraseña").fill("incorrecta")
  await page.getByRole("button", { name: "Ingresar" }).click()
  await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible()

  await login(page, main().email)
  await expect(page).toHaveURL("http://localhost:5173/")
})

test("ruta protegida → login → vuelve; recarga mantiene la sesión; logout la cierra (1 registro + 1 login)", async ({
  page,
}) => {
  const user = uniqueUser()
  const res = await page.request.post(`${API}/auth/signup`, {
    data: { email: user.email, password: PASSWORD, tag: user.alias },
  })
  expect(res.status()).toBe(201)

  await page.goto("/panel")
  await expect(page).toHaveURL(/\/ingresar\?redirect=%2Fpanel$/)
  await login(page, user.email)
  await expectPanel(page, user.alias)

  await page.reload()
  await expectPanel(page, user.alias)

  await page.getByRole("button", { name: user.alias }).click()
  await page.getByRole("menuitem", { name: "Salir" }).click()
  await expect(page).toHaveURL("http://localhost:5173/")
  await expect(page.getByRole("link", { name: "Ingresar" })).toBeVisible()
  expect(await readSession(page)).toBeNull()

  // El servidor revocó la sesión: el refresh token ya no sirve.
  await page.goto("/panel")
  await expect(page).toHaveURL(/\/ingresar/)
})

test("dos pestañas con Recordarme: el logout en una cierra la otra (1 login)", async ({
  context,
}) => {
  const a = await context.newPage()
  await a.goto("/ingresar")
  await login(a, main().email)
  await expect(a).toHaveURL("http://localhost:5173/")

  const b = await context.newPage()
  await b.goto("/panel")
  await expectPanel(b, main().alias)

  await a.goto("/panel")
  await a.getByRole("button", { name: main().alias }).click()
  await a.getByRole("menuitem", { name: "Salir" }).click()
  await expect(b).toHaveURL(/\/ingresar/)
})

test("sin Recordarme: otra pestaña recibe la sesión y al cerrar el navegador se pierde (1 login)", async ({
  browser,
}) => {
  const context = await browser.newContext()
  const a = await context.newPage()
  await a.goto("/ingresar")
  await login(a, main().email, { remember: false })
  await expect(a).toHaveURL("http://localhost:5173/")
  expect(await readSession(a, "local")).toBeNull()
  expect(await readSession(a, "session")).not.toBeNull()

  // sessionStorage no se comparte: la pestaña nueva la pide por BroadcastChannel.
  const b = await context.newPage()
  await b.goto("/panel")
  await expectPanel(b, main().alias)

  // Un contexto nuevo con el mismo storage persistente equivale a reabrir el navegador.
  const state = await context.storageState()
  await context.close()
  const reopened = await browser.newContext({ storageState: state })
  const c = await reopened.newPage()
  await c.goto("/panel")
  await expect(c).toHaveURL(/\/ingresar/)
  await reopened.close()
})

test("token vencido: se renueva sin que se note (1 login)", async ({
  page,
}) => {
  await page.goto("/ingresar")
  await login(page, main().email)
  await expect(page).toHaveURL("http://localhost:5173/")
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
  await page.goto("/panel")
  await expectPanel(page, main().alias)
  const after = await readSession(page)
  expect(after!.refreshToken).not.toBe(before!.refreshToken)
  expect(after!.expiresAt).toBeGreaterThan(Date.now())
})

test.describe("con la sesión compartida", () => {
  test.use({ storageState: USER_STATE })

  test("con Recordarme la sesión sigue al reabrir el navegador", async ({
    page,
  }) => {
    await page.goto("/panel")
    await expectPanel(page, main().alias)
  })

  test("un usuario común ve 403 en /admin", async ({ page }) => {
    await page.goto("/admin")
    await expect(page.getByText("403")).toBeVisible()
    await expect(page.getByText("Sin permiso")).toBeVisible()
  })

  test("con la API caída no manda al login: muestra el error", async ({
    page,
  }) => {
    await page.route(`${API}/**`, (route) => route.abort("connectionrefused"))
    await page.goto("/panel")
    await expect(
      page.getByRole("heading", { name: "No se pudo conectar" })
    ).toBeVisible()
    await expect(page).toHaveURL(/\/panel$/)
  })

  test("en las páginas de cuenta, con sesión, sale al inicio", async ({
    page,
  }) => {
    await page.goto("/ingresar")
    await expect(page).toHaveURL("http://localhost:5173/")
  })
})
