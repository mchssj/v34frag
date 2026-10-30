import { expect, test } from "@playwright/test"

import { USER_STATE } from "./helpers"
import {
  E_DONE,
  E_LIVE,
  E_REG,
  LIVE_MATCHES,
  mockEvents,
} from "./event-fixtures"
import { TEAM_ID } from "./team-fixtures"

// Torneos: listado y detalle. Usa la sesión compartida (no gasta logins) y simula las rutas de
// torneos (event-fixtures): la base local no tiene torneos.
test.use({ storageState: USER_STATE })

test("contra la API real: el listado carga sin errores", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto("/events")
  await expect(
    page.getByRole("heading", { name: "Torneos y copas" })
  ).toBeVisible()
  await expect(
    page.getByRole("group", { name: "Filtrar por estado" })
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("listado: orden por estado, pie de cada tarjeta y filtro en la URL", async ({
  page,
}) => {
  // Todo sale de GET /events: ninguna tarjeta pide el detalle ni las partidas.
  const extra: string[] = []
  page.on("request", (r) => {
    if (/\/api\/v1\/events\/[^/?]+/.test(r.url())) extra.push(r.url())
  })
  await mockEvents(page)
  await page.goto("/events")
  const cards = page.getByRole("link").filter({ hasText: /Copa|Liga/ })
  await expect(cards).toHaveText([
    /Liga Verano 2026.*5v5 · Eliminación directa · BO3 · Final BO3.*Cupo.*3\/12/,
    /Copa Otoño 2026.*BO3 · Final BO5.*Etapa actual.*Semifinal/,
    /Copa Invierno 2025.*Grupos \+ playoffs · BO1 · Final BO3.*Campeón.*Furia Sur/,
  ])
  expect(extra).toEqual([])

  await page.getByRole("button", { name: "En curso" }).click()
  await expect(page).toHaveURL(/\/events\?status=in_progress$/)
  await expect(cards).toHaveCount(1)
  await expect(page.getByRole("button", { name: "En curso" })).toHaveAttribute(
    "aria-pressed",
    "true"
  )

  await cards.first().click()
  await expect(page).toHaveURL(new RegExp(`/events/${E_LIVE}$`))
  await expect(
    page.getByRole("heading", { name: "Copa Otoño 2026" })
  ).toBeVisible()
})

test("inscripciones, líder: activos y suplentes, y cancelar", async ({
  page,
}) => {
  const calls = await mockEvents(page)
  await page.goto(`/events/${E_REG}`)
  await expect(
    page.getByText(
      "Elige 2 activos y hasta 1 suplente del roster · 9 cupos libres"
    )
  ).toBeVisible()
  await page.getByRole("button", { name: "Inscribir a Furia Sur" }).click()

  const dialog = page.getByRole("dialog")
  await expect(
    dialog.getByText("5v5 · 2 activos + hasta 1 suplente")
  ).toBeVisible()
  // Los dos primeros Activos con SteamID vienen como activos; sin SteamID y el coach no se eligen.
  const row = (alias: string) =>
    dialog.getByRole("group", { name: `Inscribir a ${alias}` })
  await expect(
    row("Zeta").getByRole("button", { name: "Activo" })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    row("kova").getByRole("button", { name: "Activo" })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(row("nacho")).toHaveCount(0)
  await expect(dialog.getByText("Sin SteamID vinculado")).toBeVisible()
  await expect(
    dialog.getByText("El coach no se inscribe", { exact: true })
  ).toBeVisible()
  // Con el cupo de activos lleno, Tormenta no puede ser activo, pero sí suplente.
  await expect(
    row("Tormenta").getByRole("button", { name: "Activo" })
  ).toBeDisabled()
  await row("Tormenta").getByRole("button", { name: "Suplente" }).click()
  await expect(dialog.getByText("2/2 activos · 1/1 suplentes")).toBeVisible()

  // Sin los dos activos no se puede enviar.
  await row("kova").getByRole("button", { name: "Activo" }).click()
  await expect(dialog.getByRole("button", { name: "Inscribir" })).toBeDisabled()
  await row("kova").getByRole("button", { name: "Activo" }).click()
  await dialog.getByRole("button", { name: "Inscribir" }).click()

  await expect(
    page.getByText("Furia Sur quedó inscripto en Liga Verano 2026")
  ).toBeVisible()
  expect(calls).toContainEqual({
    method: "PUT",
    path: `/api/v1/events/${E_REG}/registrations/${TEAM_ID}`,
    body: { active: ["p-yo", "p-kova"], subs: ["p-torm"] },
  })

  // "Cambiar inscritos" abre el diálogo con lo que quedó inscripto.
  await page.getByRole("button", { name: "Cambiar inscritos" }).click()
  await expect(
    row("Tormenta").getByRole("button", { name: "Suplente" })
  ).toHaveAttribute("aria-pressed", "true")
  await dialog.getByRole("button", { name: "Cancelar" }).click()
  // El equipo aparece entre los inscritos y el botón pasa a cancelar.
  await expect(page.getByRole("link", { name: /Furia Sur/ })).toBeVisible()
  await expect(page.getByText("4 / 12 equipos")).toBeVisible()

  await page.getByRole("button", { name: "Cancelar inscripción" }).click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar inscripción" })
    .click()
  await expect(page.getByText("Inscripción cancelada")).toBeVisible()
  expect(calls.at(-1)).toMatchObject({
    method: "DELETE",
    path: `/api/v1/events/${E_REG}/registrations/${TEAM_ID}`,
  })
  await expect(
    page.getByRole("button", { name: "Inscribir a Furia Sur" })
  ).toBeVisible()
})

test("inscripciones cerradas: el líder ya no puede inscribir", async ({
  page,
}) => {
  await mockEvents(page, { closed: true })
  await page.goto(`/events/${E_REG}`)
  await expect(
    page.getByRole("button", { name: "Inscripciones cerradas" })
  ).toBeDisabled()
  await expect(page.getByText(/^Cerraron el 01 ene/)).toBeVisible()
  await expect(page.getByText("Cierre de inscripciones")).toBeVisible()
})

test("inscripciones, jugador sin liderazgo: le toca al líder", async ({
  page,
}) => {
  await mockEvents(page, { leader: false })
  await page.goto(`/events/${E_REG}`)
  await expect(
    page.getByRole("button", { name: "Pídele al líder que inscriba" })
  ).toBeDisabled()
  await expect(
    page.getByText("Solo el líder de Furia Sur puede inscribirlo")
  ).toBeVisible()
})

test("llave en curso: en vivo, camino del equipo, zoom y clic hacia la partida", async ({
  page,
}) => {
  await mockEvents(page)
  await page.goto(`/events/${E_LIVE}`)
  // Con una partida en vivo, el botón lleva a ella.
  const live = LIVE_MATCHES[4]
  await expect(
    page.getByRole("link", { name: "Ver partida en vivo" })
  ).toHaveAttribute("href", `/match/${live.id}`)
  await expect(
    page.getByText("Semifinal · Mapa 2 de 3 · de_dust2")
  ).toBeVisible()
  await page.getByRole("link", { name: "Llave" }).click()
  await expect(page).toHaveURL(new RegExp(`/events/${E_LIVE}\\?tab=bracket$`))

  const canvas = page.getByTestId("bracket-canvas")
  await expect(canvas.getByText("VIVO")).toBeVisible()
  await expect(canvas.getByText("Campeón")).toBeVisible()

  // Pasar sobre Furia Sur apaga las partidas que no son de su camino.
  const other = canvas.getByRole("link", { name: "Andes Gaming contra Brava" })
  await canvas.getByText("Furia Sur").first().hover()
  await expect(other).toHaveCSS("opacity", "0.45")
  await expect(
    canvas.getByRole("link", { name: "Furia Sur contra Cóndor Five" })
  ).toHaveCSS("opacity", "1")

  await page.getByRole("button", { name: "Acercar" }).click()
  await expect(page.getByText("110%")).toBeVisible()
  await page.getByRole("button", { name: "Ajustar" }).click()
  await expect(page.getByText("85%")).toBeVisible()

  await canvas.getByRole("link", { name: "Furia Sur contra Vértigo" }).click()
  await expect(page).toHaveURL(new RegExp(`/match/${live.id}$`))
})

test("posiciones y partidas", async ({ page }) => {
  await mockEvents(page)
  await page.goto(`/events/${E_DONE}?tab=standings`)
  await expect(page.getByRole("heading", { name: "Grupo A" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Grupo B" })).toBeVisible()
  await expect(page.getByText("Clasifica")).toHaveCount(4)
  await expect(
    page.getByRole("link", { name: "Campeón: Furia Sur" })
  ).toBeVisible()

  await page.goto(`/events/${E_LIVE}?tab=standings`)
  await expect(
    page.getByText("Este torneo no tiene fase de grupos.")
  ).toBeVisible()

  await page.goto(`/events/${E_LIVE}?tab=matches`)
  const rows = page
    .getByRole("list", { name: "Partidas del torneo" })
    .getByRole("listitem")
  await expect(rows).toHaveCount(LIVE_MATCHES.length)
  await expect(rows.nth(0)).toContainText("FINAL")
  await expect(rows.nth(4)).toContainText("EN VIVO")
  await expect(rows.nth(5)).toContainText("PRÓXIMA")
  await expect(rows.nth(5)).toContainText("– : –")
  await expect(rows.nth(6)).toContainText("Por definir")

  await page.goto(`/events/${E_REG}?tab=bracket`)
  await expect(
    page.getByText("La llave se arma cuando se cierran las inscripciones.")
  ).toBeVisible()
})
