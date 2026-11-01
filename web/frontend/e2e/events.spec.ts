import { expect, test } from "@playwright/test"

import { USER_STATE } from "./helpers"
import {
  E_DONE,
  E_GD,
  E_LIVE,
  E_REG,
  E_SWISS,
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
    page.getByRole("radiogroup", { name: "Filtrar por estado" })
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

  await page.getByRole("radio", { name: "En curso" }).click()
  await expect(page).toHaveURL(/\/events\?status=in_progress$/)
  await expect(cards).toHaveCount(1)
  await expect(page.getByRole("radio", { name: "En curso" })).toHaveAttribute(
    "aria-checked",
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

test("llave en curso: en vivo, camino del equipo, zoom y el detalle al hacer clic", async ({
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
  const other = canvas.getByRole("button", {
    name: "Andes Gaming contra Brava",
  })
  await canvas.getByText("Furia Sur").first().hover()
  await expect(other).toHaveCSS("opacity", "0.45")
  await expect(
    canvas.getByRole("button", { name: "Furia Sur contra Cóndor Five" })
  ).toHaveCSS("opacity", "1")

  await page.getByRole("button", { name: "Acercar" }).click()
  await expect(page.getByText("110%")).toBeVisible()
  await page.getByRole("button", { name: "Ajustar" }).click()
  await expect(page.getByText("85%")).toBeVisible()

  // Sin equipos todavía, la final dice de dónde sale cada lado.
  await expect(
    canvas.getByRole("button", {
      name: "Ganador de Semifinal 1 contra Ganador de Semifinal 2",
    })
  ).toBeVisible()
  // Una sola fase: sin chips.
  await expect(
    page.getByRole("radiogroup", { name: "Fases del torneo" })
  ).toHaveCount(0)

  // El clic abre el detalle resumido; desde ahí se va a la partida.
  await canvas.getByRole("button", { name: "Furia Sur contra Vértigo" }).click()
  const detail = page.getByRole("dialog", { name: "Furia Sur contra Vértigo" })
  await expect(detail).toContainText("Semifinal · BO3 · En vivo · CMLeague #1")
  await expect(detail).toContainText("de_dust2")
  await expect(detail).toContainText("kz")
  // Rating de la serie (E21): los que jugaron, con el nombre en el juego si no tienen ficha.
  await expect(detail).toContainText("Alineaciones · rating de la serie")
  await expect(detail).toContainText("1.25")
  await expect(detail).toContainText("nox_ingame")
  await page.keyboard.press("Escape")
  await expect(detail).toBeHidden()
  await canvas.getByRole("button", { name: "Furia Sur contra Vértigo" }).click()
  await detail.getByRole("link", { name: "Ver en vivo" }).click()
  await expect(page).toHaveURL(new RegExp(`/match/${live.id}$`))
})

test("llave de grupos: chip de fase en la URL, fechas, cruces y el detalle desde una celda", async ({
  page,
}) => {
  await mockEvents(page)
  await page.goto(`/events/${E_DONE}?tab=bracket`)
  const phases = page.getByRole("radiogroup", { name: "Fases del torneo" })
  // Todo jugado: abre en la última fase, los playoffs, con el campeón.
  await expect(
    phases.getByRole("radio", { name: /^Playoffs/ })
  ).toHaveAttribute("aria-checked", "true")
  await expect(
    page.getByTestId("bracket-canvas").getByText("Campeón")
  ).toBeVisible()

  await phases.getByRole("radio", { name: /^Fase de grupos/ }).click()
  await expect(page).toHaveURL(/phase=groups/)
  const groupA = page.getByRole("region", { name: "Grupo A" })
  await expect(groupA).toContainText("4 equipos · clasifican 2 · BO1")
  await expect(groupA.getByText("Fecha 3")).toBeVisible()
  await expect(
    groupA.getByRole("button", { name: "Furia Sur contra Cóndor Five" })
  ).toBeVisible()

  await groupA.getByRole("radio", { name: "Cruces" }).click()
  await expect(groupA.getByText("Fecha 3")).toHaveCount(0)
  await groupA
    .getByRole("button", { name: "Furia Sur contra Cóndor Five: 1:0" })
    .click()
  const detail = page.getByRole("dialog", {
    name: "Furia Sur contra Cóndor Five",
  })
  await expect(detail).toContainText("Grupo A · fecha 1 · BO1 · Terminada")
  await expect(detail.getByRole("link", { name: "Ver partida" })).toBeVisible()

  // La fase elegida sobrevive a la recarga.
  await page.reload()
  await expect(
    phases.getByRole("radio", { name: /^Fase de grupos/ })
  ).toHaveAttribute("aria-checked", "true")
})

test("llave del suizo: recuadros por récord, franjas y rondas por armar", async ({
  page,
}) => {
  await mockEvents(page)
  await page.goto(`/events/${E_SWISS}?tab=bracket`)
  const phases = page.getByRole("radiogroup", { name: "Fases del torneo" })
  await expect(
    phases.getByRole("radio", { name: /^Fase suiza/ })
  ).toHaveAttribute("aria-checked", "true")
  const canvas = page.getByTestId("bracket-canvas")
  for (const record of ["0:0", "1:0", "0:1", "2:0", "1:1", "0:2", "2:2"])
    await expect(
      canvas.getByText(record, { exact: true }).first()
    ).toBeVisible()
  await expect(
    canvas.getByRole("group", { name: "Clasificados" })
  ).toContainText("3:0")
  await expect(canvas.getByRole("group", { name: "Eliminados" })).toContainText(
    "0:3"
  )
  // Rondas 4 y 5 todavía no existen: 3 + 3 + 3 partidas por armar.
  await expect(canvas.getByText("Partida por armar")).toHaveCount(9)
  await expect(canvas.getByText("VIVO")).toBeVisible()

  // Solo escudos: el nombre aparece en el detalle.
  await canvas.getByRole("button", { name: "Suizo 1 contra Suizo 16" }).click()
  const detail = page.getByRole("dialog", { name: "Suizo 1 contra Suizo 16" })
  await expect(detail).toContainText(
    "Suizo · fase 1 · ronda 1 · BO1 · Terminada"
  )
  await expect(detail).toContainText("Suizo 1")
})

test("llave de grupos de doble eliminación: upper y lower por grupo con sus destinos", async ({
  page,
}) => {
  await mockEvents(page)
  await page.goto(`/events/${E_GD}?tab=bracket`)
  const phases = page.getByRole("radiogroup", { name: "Fases del torneo" })
  await expect(phases.getByRole("radio", { name: /^Grupos/ })).toHaveAttribute(
    "aria-checked",
    "true"
  )
  const groupA = page.getByRole("region", { name: "Grupo A" })
  await expect(groupA.getByText("Upper", { exact: true })).toBeVisible()
  await expect(groupA.getByText("Lower", { exact: true })).toBeVisible()
  await expect(groupA.getByText("→ PO")).toHaveCount(2)
  await expect(groupA.getByText("↓ L1")).toHaveCount(2)
  await expect(groupA.getByText("✕ 4.º")).toBeVisible()
  await expect(groupA.getByText("✕ 3.º")).toBeVisible()

  // Plegar un grupo.
  await groupA.getByRole("button", { name: /Grupo A/ }).click()
  await expect(groupA.getByText("Upper", { exact: true })).toHaveCount(0)

  await phases.getByRole("radio", { name: /^Playoffs/ }).click()
  await expect(
    page.getByText("Los playoffs se arman cuando termina la fase de grupos.")
  ).toBeVisible()
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
