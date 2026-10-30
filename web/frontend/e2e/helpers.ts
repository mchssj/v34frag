import {
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test"

import { spendAuth } from "./authBudget"

export const API = process.env.VITE_API_URL ?? "http://localhost:8787"
export const APP = "http://localhost:5173"
export const STORAGE_KEY = "csstv.session"
export const USER_STATE = "e2e/.auth/user.json"
export const USER_INFO = "e2e/.auth/user-info.json"
export const PASSWORD = "secreta-e2e-123"

export function uniqueUser(prefix = "e2e") {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return {
    email: `${prefix}-${id}@test.local`,
    alias: `${prefix}${id}`.slice(0, 24),
  }
}

export type StoredSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export async function readSession(
  page: Page,
  storage: "local" | "session" = "local"
) {
  return page.evaluate(
    ([key, kind]) => {
      const raw = (kind === "local" ? localStorage : sessionStorage).getItem(
        key
      )
      return raw ? (JSON.parse(raw) as StoredSession) : null
    },
    [STORAGE_KEY, storage] as const
  )
}

export async function login(
  page: Page,
  email: string,
  opts: { remember?: boolean } = {}
) {
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Contraseña").fill(PASSWORD)
  if (opts.remember === false)
    await page.getByLabel("Recordarme en este equipo").uncheck()
  await spendAuth()
  await page.getByRole("button", { name: "Iniciar sesión" }).click()
}

/** Marca la Bienvenida como vista para ese usuario (pruebas que no tratan sobre ella). */
export async function skipWelcome(
  target: Page | BrowserContext,
  userId: string
) {
  await target.addInitScript(
    (id) => localStorage.setItem(`csstv.welcome-seen.${id}`, "1"),
    userId
  )
}

export async function expectHome(page: Page, alias: string) {
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByText(`Hola, ${alias}`)).toBeVisible()
}

/** Cerrar sesión: menú de cuenta del pie del sidebar y confirmación. */
export async function logout(page: Page) {
  await page.getByRole("button", { name: /^Menú de cuenta/ }).click()
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click()
  await page
    .getByRole("dialog", { name: "¿Cerrar sesión?" })
    .getByRole("button", { name: "Cerrar sesión" })
    .click()
}

/** Sube el zoom del encuadre del avatar con el teclado y comprueba que cambió. */
export async function zoomIn(dialog: Locator, steps = 20) {
  const slider = dialog.getByRole("slider", { name: "Zoom" })
  await slider.focus()
  for (let i = 0; i < steps; i++) await slider.press("ArrowRight")
  await expect(slider).not.toHaveAttribute("aria-valuenow", "1")
}
