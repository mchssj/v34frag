import { expect, test } from "@playwright/test"

import { API, USER_STATE } from "./helpers"
import { mockMyTeams, OTHER_ID, TEAM_ID } from "./team-fixtures"

// Equipo: Mi equipo, vista pública, Crear y Buscar. Usa la sesión compartida (sin equipo ni
// SteamID): no gasta logins. La vista de capitán simula las rutas de equipos (team-fixtures).
test.use({ storageState: USER_STATE })

test.describe("sin equipo, contra la API real", () => {
  test("Sin equipo → Buscar equipo: lista real, búsqueda y el aviso de SteamID al pedir entrar", async ({
    page,
  }) => {
    await page.goto("/myteam")
    await expect(
      page.getByRole("heading", {
        name: "Arma tu quinteto y entra a competir.",
      })
    ).toBeVisible()
    await page.getByRole("button", { name: "Buscar equipo" }).click()
    await expect(page).toHaveURL(/\/myteam\?view=find$/)
    await expect(
      page.getByRole("heading", { name: "Buscar equipo" })
    ).toBeVisible()

    // El primer equipo real de la base local.
    const first = (
      await (await page.request.get(`${API}/api/v1/teams?per=1`)).json()
    ).items[0] as { id: string; name: string }
    const card = page
      .getByRole("listitem")
      .filter({ hasText: first.name })
      .first()
    await expect(card).toBeVisible()

    await page.getByLabel("Nombre o sigla del equipo").fill("zzz-no-existe")
    await expect(
      page.getByText("No hay equipos que coincidan con la búsqueda.")
    ).toBeVisible()
    await page.getByLabel("Nombre o sigla del equipo").fill(first.name)
    await card.getByRole("button", { name: "Pedir entrar" }).click()
    // La cuenta de prueba no tiene SteamID: el backend lo rechaza y se muestra su mensaje.
    await expect(page.getByText(/SteamID vinculado/)).toBeVisible()

    // Filtro por lo que busca cada equipo: va a la API como looking_for.
    await page.getByLabel("Nombre o sigla del equipo").fill("")
    const filtered = page.waitForRequest((r) =>
      r.url().includes("looking_for=sub")
    )
    await page.getByRole("button", { name: "Buscan suplente" }).click()
    await filtered
    await expect(
      page.getByRole("button", { name: "Buscan suplente" })
    ).toHaveAttribute("aria-pressed", "true")

    await page.getByRole("button", { name: "Volver" }).click()
    await expect(page).toHaveURL(/\/myteam$/)
  })

  test("Crear equipo: vista previa del escudo, validación y el aviso de SteamID", async ({
    page,
  }) => {
    await page.goto("/myteam?view=create")
    const send = page.getByRole("button", { name: "Enviar solicitud" })
    await expect(send).toBeDisabled()
    await page.getByLabel("Nombre").fill("Lobos del Sur")
    await page.getByLabel("Sigla").fill("lds")
    await expect(page.getByLabel("Sigla")).toHaveValue("LDS")
    await expect(page.getByText("Lobos del Sur", { exact: true })).toBeVisible()

    // Logo: elegir una imagen, encuadrarla y verla en el escudo.
    const png = await page.evaluate(() => {
      const c = document.createElement("canvas")
      c.width = 300
      c.height = 200
      const ctx = c.getContext("2d")!
      ctx.fillStyle = "#ff6900"
      ctx.fillRect(0, 0, 300, 200)
      return c.toDataURL("image/png").split(",")[1]
    })
    const chooser = page.waitForEvent("filechooser")
    await page.getByRole("button", { name: "Subir imagen" }).click()
    await (
      await chooser
    ).setFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    })
    const crop = page.getByRole("dialog", { name: "Encuadra el logo" })
    await crop.getByRole("button", { name: "Usar logo" }).click()
    await expect(crop).toBeHidden()
    await expect(page.locator("img[src^='blob:']")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Cambiar imagen" })
    ).toBeVisible()

    // La solicitud va en multipart con el logo; la cuenta no tiene SteamID y el backend la rechaza.
    const request = page.waitForRequest(
      (r) => r.url().endsWith("/api/v1/me/team-request") && r.method() === "PUT"
    )
    await send.click()
    expect((await request).headers()["content-type"]).toContain(
      "multipart/form-data"
    )
    await expect(page.getByText(/SteamID vinculado/)).toBeVisible()
  })

  test("solicitud pendiente: se ve en una tarjeta y se edita", async ({
    page,
  }) => {
    await page.route("**/api/v1/me/team-request", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            json: {
              name: "Lobos del Sur",
              tag: "LDS",
              status: "pending",
              logo_url: null,
            },
          })
        : route.continue()
    )
    await page.goto("/myteam")
    await expect(page.getByText("Pendiente de aprobación")).toBeVisible()
    await expect(page.getByText("Lobos del Sur")).toBeVisible()
    // Mientras está pendiente, la tarjeta reemplaza a "Crear equipo"; cancelar espera al backend.
    await expect(
      page.getByRole("button", { name: "Crear equipo" })
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Cancelar solicitud" })
    ).toBeDisabled()
    await page.getByRole("button", { name: "Editar solicitud" }).click()
    await expect(page).toHaveURL(/view=create&edit=true/)
    await expect(page.getByLabel("Nombre")).toHaveValue("Lobos del Sur")
    await expect(page.getByLabel("Sigla")).toHaveValue("LDS")
  })

  test("vista pública de un equipo real: datos, roster y sin herramientas de gestión", async ({
    page,
  }) => {
    const team = (
      await (
        await page.request.get(
          `${API}/api/v1/teams?per=1&sort=members&order=desc`
        )
      ).json()
    ).items[0] as { id: string; name: string; members: number }
    await page.goto(`/teams/${team.id}`)
    await expect(
      page.getByRole("heading", { name: team.name, level: 1 })
    ).toBeVisible()
    await expect(
      page.getByText(`${team.members}/10 en el roster`)
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Pedir entrar" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Invitar jugador" })
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: /^Opciones de / })
    ).toHaveCount(0)
    await expect(page.getByText("Pedidos para entrar")).toHaveCount(0)
    await expect(page.getByText("Torneos en los que participó")).toBeVisible()
  })
})

test.describe("capitán, con la API de equipos simulada", () => {
  test("Mi equipo: selector, roster agrupado, menú ⋯, expulsar, aceptar un pedido e invitar", async ({
    page,
  }) => {
    const calls = await mockMyTeams(page, [
      { id: TEAM_ID, name: "Furia Sur", tag: "FUR" },
      { id: OTHER_ID, name: "Nómades", tag: "NMD" },
    ])
    await page.goto("/myteam")
    await expect(
      page.getByRole("heading", { name: "Furia Sur", level: 1 })
    ).toBeVisible()

    // Selector "Mis equipos" (2 equipos: segmentado) con el rol en cada uno.
    const picker = page.getByRole("radiogroup", { name: "Mis equipos" })
    await expect(
      picker.getByRole("radio", { name: /Furia Sur.*líder/ })
    ).toHaveAttribute("aria-checked", "true")
    await expect(page.getByText("Líder Zeta")).toBeVisible()
    await expect(page.getByText("82%")).toBeVisible()

    // KPI de torneos, "desde" con founded_at, mapa de puestos e historial.
    await expect(page.getByText("Mi equipo · desde ene 2025")).toBeVisible()
    const kpi = page.getByText("Torneos jugados", { exact: true }).locator("..")
    await expect(kpi).toContainText("3")
    const roles = page.getByRole("list", { name: "Roles de equipo" })
    await expect(
      roles.getByRole("listitem").filter({ hasText: "AWPer" })
    ).toContainText("kova")
    await expect(
      roles.getByRole("listitem").filter({ hasText: "Entry" })
    ).toContainText("Tormenta")
    await expect(roles).not.toContainText("Profe")
    await expect(page.getByText("Otros puestos")).toBeVisible()
    await expect(page.getByText("Rifler", { exact: true })).toBeVisible()
    const history = page.getByRole("list", {
      name: "Torneos en los que participó",
    })
    await expect(
      history.getByRole("link", { name: /Copa Invierno 2025.*Campeón/ })
    ).toBeVisible()
    await expect(
      history.getByRole("link", { name: /Liga Apertura 2026.*En curso/ })
    ).toBeVisible()

    // Roster agrupado, con el puesto de cada uno.
    for (const group of ["Activos", "Suplentes", "Coach"])
      await expect(page.getByRole("group", { name: group })).toBeVisible()
    await expect(page.getByText(/AWPer · desde/)).toBeVisible()

    // Menú ⋯: el estado se cambia (sin topes); ceder deshabilitado sin SteamID.
    await page.getByRole("button", { name: "Opciones de nacho" }).click()
    await page.getByRole("menuitem", { name: "Activo" }).click()
    await expect(page.getByText("nacho ahora es activo")).toBeVisible()
    expect(calls).toContainEqual({
      method: "PATCH",
      path: `/api/v1/teams/${TEAM_ID}/members/p-nacho`,
      body: { role: "player" },
    })
    await page.getByRole("button", { name: "Opciones de nacho" }).click()
    await expect(
      page.getByRole("menuitem", { name: /Ceder liderazgo/ })
    ).toHaveAttribute("aria-disabled", "true")
    await page.getByRole("menuitem", { name: "Expulsar del equipo" }).click()
    const kick = page.getByRole("dialog", { name: "Expulsar a nacho" })
    await kick.getByRole("button", { name: "Expulsar" }).click()
    await expect(kick).toBeHidden()
    expect(calls).toContainEqual(
      expect.objectContaining({
        method: "DELETE",
        path: `/api/v1/teams/${TEAM_ID}/members/p-nacho`,
      })
    )

    // Ceder liderazgo a alguien con SteamID.
    await page.getByRole("button", { name: "Opciones de kova" }).click()
    await page.getByRole("menuitem", { name: /Ceder liderazgo/ }).click()
    await page
      .getByRole("dialog", { name: "Ceder liderazgo a kova" })
      .getByRole("button", { name: "Ceder liderazgo" })
      .click()
    await expect(
      page.getByText("kova ahora es el líder de Furia Sur")
    ).toBeVisible()
    expect(calls).toContainEqual(
      expect.objectContaining({
        method: "POST",
        path: `/api/v1/teams/${TEAM_ID}/captain`,
      })
    )

    // Pedidos para entrar, con el mensaje del jugador.
    await expect(
      page.getByText("“Juego de support, puedo martes y jueves.”")
    ).toBeVisible()
    await page.getByRole("button", { name: "Aceptar" }).click()
    await expect(page.getByText("Chispa entró al equipo")).toBeVisible()
    expect(calls).toContainEqual(
      expect.objectContaining({
        method: "POST",
        path: "/api/v1/join-requests/req-1/accept",
      })
    )

    // El líder no tiene "Salir del equipo" a la vista: va en el menú ⋯.
    await expect(
      page.getByRole("button", { name: "Salir del equipo" })
    ).toHaveCount(0)

    // Cambiar de equipo con el selector.
    await picker.getByRole("radio", { name: /Nómades/ }).click()
    await expect(page).toHaveURL(new RegExp(`team=${OTHER_ID}`))
    await expect(
      page.getByRole("heading", { name: "Nómades", level: 1 })
    ).toBeVisible()
  })

  test("Invitar jugador: busca jugadores reales y manda la invitación", async ({
    page,
  }) => {
    const calls = await mockMyTeams(page, [
      { id: TEAM_ID, name: "Furia Sur", tag: "FUR" },
    ])
    await page.goto("/myteam")
    await page.getByRole("button", { name: "Invitar jugador" }).click()
    const drawer = page.getByRole("dialog", { name: "Invitar jugador" })
    const send = drawer.getByRole("button", { name: "Enviar invitación" })
    await expect(send).toBeDisabled()
    const real = (
      await (
        await page.request.get(
          `${API}/api/v1/players?has_account=true&has_steam=true&per=1`
        )
      ).json()
    ).items[0] as { alias: string }
    await drawer.getByLabel("Alias del jugador").fill(real.alias)
    await drawer
      .getByRole("button")
      .filter({ hasText: real.alias })
      .first()
      .click()
    // Estado en el roster y mensaje opcional.
    await drawer.getByRole("radio", { name: "Suplente" }).click()
    await drawer.getByLabel(/Mensaje/).fill("Te sumamos para la Liga.")
    await send.click()
    await expect(
      page.getByText(`Invitación enviada a ${real.alias}`)
    ).toBeVisible()
    expect(calls).toContainEqual(
      expect.objectContaining({
        method: "POST",
        path: `/api/v1/teams/${TEAM_ID}/invites`,
        body: expect.objectContaining({
          role: "sub",
          message: "Te sumamos para la Liga.",
        }),
      })
    )
  })

  test("Reclutar: el líder elige qué busca el equipo", async ({ page }) => {
    const calls = await mockMyTeams(page, [
      { id: TEAM_ID, name: "Furia Sur", tag: "FUR" },
    ])
    await page.goto("/myteam")
    await page.getByRole("button", { name: "Reclutar" }).click()
    const sheet = page.getByRole("dialog", { name: "Reclutar jugadores" })
    await sheet.getByRole("checkbox", { name: /Coach/ }).click()
    await sheet.getByRole("checkbox", { name: /Suplente/ }).click()
    await sheet.getByRole("button", { name: "Guardar" }).click()
    await expect(
      page.getByText("Listo: tu equipo aparece buscando")
    ).toBeVisible()
    // En el orden de las opciones, no en el de los clics.
    expect(calls).toContainEqual({
      method: "PATCH",
      path: `/api/v1/teams/${TEAM_ID}`,
      body: { looking_for: ["sub", "coach"] },
    })
  })

  test("Editar equipo: desde el menú ⋯ o el escudo, y Buscar equipo junto a Mis equipos", async ({
    page,
  }) => {
    await mockMyTeams(page, [{ id: TEAM_ID, name: "Furia Sur", tag: "FUR" }])
    await page.goto("/myteam")
    await page.getByRole("button", { name: "Más acciones" }).click()
    await page.getByRole("menuitem", { name: "Editar equipo" }).click()
    const sheet = page.getByRole("dialog", { name: "Editar equipo" })
    await expect(sheet.getByLabel("Nombre")).toHaveValue("Furia Sur")
    await expect(sheet.getByLabel("Nombre")).toBeDisabled()
    await expect(sheet.getByRole("button", { name: "Cambiar" })).toBeVisible()
    // Sin logo no hay nada que eliminar.
    await expect(sheet.getByRole("button", { name: "Eliminar" })).toHaveCount(0)
    await sheet
      .getByRole("button", { name: "Cerrar", exact: true })
      .first()
      .click()
    await expect(sheet).toBeHidden()

    // El escudo es un atajo al mismo panel.
    await page.getByRole("button", { name: "Editar equipo" }).click()
    await expect(sheet).toBeVisible()
    await page.keyboard.press("Escape")

    await page.getByRole("button", { name: "Buscar equipo" }).click()
    await expect(page).toHaveURL(/view=find/)
  })

  test("el líder sale cediendo el liderazgo", async ({ page }) => {
    const calls = await mockMyTeams(page, [
      { id: TEAM_ID, name: "Furia Sur", tag: "FUR" },
    ])
    await page.goto("/myteam")
    await page.getByRole("button", { name: "Más acciones" }).click()
    await page.getByRole("menuitem", { name: "Salir del equipo" }).click()
    const dialog = page.getByRole("dialog", {
      name: "Antes de salir, elige quién queda como líder",
    })
    // Sin SteamID no se puede elegir; por defecto, el primero que sí.
    await expect(dialog.getByRole("radio", { name: /nacho/ })).toBeDisabled()
    await dialog.getByRole("radio", { name: /Tormenta/ }).click()
    await dialog
      .getByRole("button", { name: "Ceder a Tormenta y salir" })
      .click()
    await expect(
      page.getByText("Tormenta es el nuevo líder. Saliste de Furia Sur")
    ).toBeVisible()
    const writes = calls.map((c) => `${c.method} ${c.path}`)
    expect(writes).toEqual([
      `POST /api/v1/teams/${TEAM_ID}/captain`,
      `POST /api/v1/teams/${TEAM_ID}/leave`,
    ])
    expect(calls[0].body).toEqual({ player_id: "p-torm" })
  })

  test("con 5 equipos el selector es un desplegable", async ({ page }) => {
    const ids = ["a", "b", "c", "d", "e"].map(
      (c) =>
        `${c.repeat(8)}-${c.repeat(4)}-4${c.repeat(3)}-8${c.repeat(3)}-${c.repeat(12)}`
    )
    const names = ["Furia Sur", "Nómades", "Brava", "Andes", "Vértigo"]
    await mockMyTeams(
      page,
      ids.map((id, i) => ({
        id,
        name: names[i],
        tag: names[i].slice(0, 3).toUpperCase(),
      }))
    )
    await page.goto("/myteam")
    await page.getByRole("button", { name: "Mis equipos: Furia Sur" }).click()
    await expect(page.getByText("Tus equipos · 5")).toBeVisible()
    await page.getByRole("menuitem", { name: /Vértigo/ }).click()
    await expect(
      page.getByRole("heading", { name: "Vértigo", level: 1 })
    ).toBeVisible()
  })
})
