import { expect, test, type Page } from "@playwright/test"

import {
  API,
  PASSWORD,
  STORAGE_KEY,
  USER_STATE,
  uniqueUser,
  zoomIn,
} from "./helpers"
import { spendAuth } from "./authBudget"

// Mi perfil. Una cuenta nueva por prueba que la modifica: el alias se bloquea 15 días y los
// códigos de !claim tienen un límite de 5 por hora. Se crea con la API (1 registro) y la sesión
// se pasa al navegador (sin gastar un login).
const NEW_PASSWORD = "Nueva-clave-2026"

async function signedUpUser(page: Page) {
  return (await signedUpUserWithToken(page)).user
}

async function signedUpUserWithToken(page: Page) {
  const user = uniqueUser("perfil")
  await spendAuth()
  const res = await page.request.post(`${API}/auth/signup`, {
    data: { email: user.email, password: PASSWORD, tag: user.alias },
  })
  expect(res.status()).toBe(201)
  const { session } = await res.json()
  await page.addInitScript(
    ([key, s, id]) => {
      // Una sola vez por pestaña: las recargas no tienen que pisar la sesión que guardó la app.
      if (sessionStorage.getItem("e2e.injected")) return
      sessionStorage.setItem("e2e.injected", "1")
      localStorage.setItem(
        key,
        JSON.stringify({
          accessToken: s.access_token,
          refreshToken: s.refresh_token,
          expiresAt: s.expires_at * 1000,
        })
      )
      // No es sobre la Bienvenida: que el login no la muestre.
      localStorage.setItem(`csstv.welcome-seen.${id}`, "1")
    },
    [STORAGE_KEY, session, session.user.id] as const
  )
  return {
    user,
    token: session.access_token as string,
    refreshToken: session.refresh_token as string,
  }
}

test("Mi perfil: secciones, datos, cuentas, alias y código (1 registro)", async ({
  page,
}) => {
  const user = await signedUpUser(page)
  await page.goto("/profile")
  await expect(page.getByRole("heading", { name: "Mi perfil" })).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" })
  ).toContainText("Mi perfil")

  // Foto: cancelar el encuadre no sube nada; guardarlo sí.
  const avatar = page.getByRole("button", { name: "Elegir foto de perfil" })
  const file = page.locator('input[type="file"]')
  const crop = page.getByRole("dialog", { name: "Encuadra tu foto" })
  await file.setInputFiles("src/assets/landing-bg.webp")
  await crop.getByRole("button", { name: "Cancelar" }).click()
  await expect(crop).toBeHidden()
  await expect(avatar.locator("img")).toHaveCount(0)
  await file.setInputFiles("src/assets/landing-bg.webp")
  await zoomIn(crop, 40)
  await crop.getByRole("button", { name: "Guardar foto" }).click()
  await expect(avatar.locator("img")).toBeVisible()

  // Datos.
  await page.getByLabel("Nombre real").fill("Martín Ruiz")
  await page.getByLabel("Puesto preferido").click()
  await page.getByRole("option", { name: "IGL" }).click()
  await page.getByRole("button", { name: "Guardar cambios" }).click()
  await expect(page.getByText("Perfil guardado")).toBeVisible()

  // Alias: disponible, se cambia y queda bloqueado 15 días.
  const nuevo = `${user.alias.slice(0, 20)}x`
  await page.getByLabel("Alias", { exact: true }).fill(nuevo)
  await expect(
    page.getByText(
      "Disponible. Después de cambiarlo tendrás que esperar 15 días."
    )
  ).toBeVisible()
  await page.getByRole("button", { name: "Cambiar alias" }).click()
  await expect(page.getByText(`Alias cambiado a ${nuevo}`)).toBeVisible()
  await expect(page.getByText(/^Podrás cambiarlo el /)).toBeVisible()
  await expect(page.getByLabel("Alias", { exact: true })).toBeDisabled()

  // Vinculación: sin cuentas de juego, código para !claim y cuentas conectadas.
  await page.getByRole("link", { name: "Vinculación" }).click()
  await expect(page).toHaveURL(/\/profile\/link$/)
  await expect(
    page.getByText("Todavía no vinculaste ninguna cuenta")
  ).toBeVisible()
  await expect(
    page.getByText("Vincula tu primera cuenta desde el juego")
  ).toBeVisible()
  await expect(page.getByLabel(/^0 de \d cuentas vinculadas$/)).toBeVisible()
  await page.getByRole("button", { name: "Generar código" }).click()
  await expect(page.getByText(/^!claim [A-Z0-9]{6}$/)).toBeVisible()
  await expect(
    page.getByText(/^Esperando que lo escribas en el chat · vence en /)
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Generar otro código" })
  ).toBeVisible()
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await page.getByRole("button", { name: "Copiar" }).click()
  await expect(page.getByText("Comando copiado")).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /^!claim [A-Z0-9]{6}$/
  )
  await page
    .getByLabel("FACEIT")
    .fill("https://www.faceit.com/es/players/Zeta_CS")
  // Steam es solo el link del perfil: se guarda normalizado.
  await page.getByLabel("Steam").fill("steamcommunity.com/id/zeta_cs")
  await page.getByRole("button", { name: "Guardar cuentas" }).click()
  await expect(page.getByText("Cuentas guardadas")).toBeVisible()
  await page.reload()
  await expect(page.getByLabel("FACEIT")).toHaveValue("Zeta_CS")
  await expect(page.getByLabel("Steam")).toHaveValue(
    "https://steamcommunity.com/id/zeta_cs"
  )

  // Cuenta: cerrar sesión.
  await page.getByRole("link", { name: "Cuenta" }).click()
  await expect(page.getByText("Rol de cuenta")).toBeVisible()
  await page.getByRole("button", { name: "Cerrar sesión" }).click()
  await expect(page).toHaveURL("http://localhost:5173/")
})

test("Cuenta: cambiar la contraseña y volver a entrar con la nueva; la preferencia de efectos de la cuenta llega al navegador (1 registro + 1 login)", async ({
  page,
}) => {
  const { user, token, refreshToken } = await signedUpUserWithToken(page)
  // La cuenta ya eligió "Sin sonido" (por ejemplo, en otra PC).
  const pref = await page.request.patch(`${API}/api/v1/me/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { preferences: { theme_fx: "silent" } },
  })
  expect(pref.ok()).toBeTruthy()

  await page.goto("/profile/account")
  // Cuenta nueva: nunca la cambió, no hay "Último cambio".
  await expect(
    page.getByRole("button", { name: "Cambiar contraseña" })
  ).toBeVisible()
  await expect(page.getByText(/^Último cambio/)).toHaveCount(0)
  await page.getByRole("button", { name: "Cambiar contraseña" }).click()
  await page.getByLabel("Contraseña actual").fill("incorrecta-1")
  await page.getByLabel("Contraseña nueva", { exact: true }).fill(NEW_PASSWORD)
  await page.getByLabel("Repite la contraseña nueva").fill(NEW_PASSWORD)
  await expect(page.getByText("Coinciden")).toBeVisible()
  await page.getByRole("button", { name: "Guardar contraseña" }).click()
  await expect(
    page.getByText("La contraseña actual no es correcta.")
  ).toBeVisible()

  await page.getByLabel("Contraseña actual").fill(PASSWORD)
  await page.getByRole("button", { name: "Guardar contraseña" }).click()
  await expect(
    page.getByText("Contraseña actualizada · cerramos las otras sesiones")
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Cambiar contraseña" })
  ).toBeVisible()
  await expect(page.getByText("Último cambio hace un momento")).toBeVisible()
  // La sesión vieja quedó cerrada (su refresh token ya no sirve), pero esta pestaña guardó la nueva.
  const old = await page.request.post(`${API}/auth/refresh`, {
    data: { refresh_token: refreshToken },
  })
  expect(old.status()).toBe(401)
  await page.reload()
  await expect(page.getByText("Rol de cuenta")).toBeVisible()

  await page.getByRole("button", { name: "Cerrar sesión" }).click()
  await expect(page).toHaveURL("http://localhost:5173/")
  await page.evaluate(() => localStorage.removeItem("csstv.themeFx"))
  await page.goto("/login")
  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Contraseña").fill(NEW_PASSWORD)
  await spendAuth()
  await page.getByRole("button", { name: "Iniciar sesión" }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("csstv.themeFx")))
    .toBe("silent")
})

test.describe("con la sesión compartida", () => {
  test.use({ storageState: USER_STATE })

  test("Preferencias guarda el tema y los efectos; Privacidad no se edita todavía", async ({
    page,
  }) => {
    await page.goto("/profile/preferences")
    const fx = page.getByRole("radiogroup", {
      name: "Efectos al cambiar de tema",
    })
    // Sin preferencia guardada se marca "Con sonido".
    await expect(fx.getByRole("radio", { name: "Con sonido" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    await fx.getByRole("radio", { name: "Desactivados" }).click()
    await expect(page.getByText("Preferencia guardada")).toBeVisible()
    expect(
      await page.evaluate(() => localStorage.getItem("csstv.themeFx"))
    ).toBe("off")
    // También queda en la cuenta.
    const token = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "{}").accessToken,
      STORAGE_KEY
    )
    const profile = await page.request.get(`${API}/api/v1/me/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect((await profile.json()).preferences.theme_fx).toBe("off")
    await page
      .getByRole("radiogroup", { name: "Tema" })
      .getByRole("radio", { name: "Oscuro" })
      .click()
    await expect(page.locator("html")).toHaveClass(/dark/)

    await page.getByRole("link", { name: "Privacidad" }).click()
    await expect(
      page.getByText("Se aplica cuando vincules tu jugador.")
    ).toBeVisible()
    await expect(page.getByRole("radio", { name: /Público/ })).toHaveAttribute(
      "aria-disabled",
      "true"
    )
  })
})
