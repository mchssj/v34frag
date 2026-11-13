import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import type { EventDetail, Registration } from "@/features/events/types"
import { renderWithQuery } from "@/test/render"
import { HistoricRegistrations } from "./HistoricRegistrations"

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const EVENT = {
  id: "e1",
  name: "Copa 2019",
  status: "registration",
  historic: true,
} as EventDetail

const reg = (over: Partial<Registration> = {}): Registration => ({
  team: { id: "t1", name: "Lobos", tag: "LOB", logo_url: null },
  seed: 1,
  start_stage: 1,
  players: [{ player_id: "p1", alias: "kyan", role: "active" }],
  guests: ["Viejo Uno"],
  ...over,
})

function serve(regs: Registration[], onPut: (body: unknown) => void) {
  server.use(
    http.get(`${API}/api/v1/events/e1/registrations`, () =>
      HttpResponse.json({ items: regs, total: regs.length, page: 1, per: 100 })
    ),
    http.get(`${API}/api/v1/players`, () =>
      HttpResponse.json({ items: [], total: 0, page: 1, per: 8 })
    ),
    http.put(
      `${API}/api/v1/events/e1/registrations/t1`,
      async ({ request }) => {
        onPut(await request.json())
        return new HttpResponse(null, { status: 204 })
      }
    )
  )
}

describe("HistoricRegistrations (replanteo 113)", () => {
  it("muestra los jugadores sin ficha en la tabla", async () => {
    serve([reg()], () => {})
    renderWithQuery(<HistoricRegistrations event={EVENT} />)
    expect(
      await screen.findByText("kyan, Viejo Uno (sin ficha)")
    ).toBeInTheDocument()
  })

  it("agrega un jugador que no está en la plataforma solo con el nombre", async () => {
    const user = userEvent.setup()
    let body: unknown
    serve([reg()], (b) => (body = b))
    renderWithQuery(<HistoricRegistrations event={EVENT} />)
    await user.click(await screen.findByRole("button", { name: "Jugadores" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Viejo Uno")).toBeInTheDocument()

    await user.type(
      within(dialog).getByRole("textbox", { name: "Buscar jugador por alias" }),
      "  Juan   Pérez "
    )
    await user.click(
      await within(dialog).findByRole("button", {
        name: /Agregar «Juan Pérez» sin ficha/,
      })
    )
    // El mismo nombre (sin distinguir mayúsculas) no se ofrece dos veces.
    await user.type(
      within(dialog).getByRole("textbox", { name: "Buscar jugador por alias" }),
      "juan pérez"
    )
    await screen.findByText("No hay jugadores con ese alias.")
    expect(
      within(dialog).queryByRole("button", { name: /sin ficha/ })
    ).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Guardar" }))
    await waitFor(() =>
      expect(body).toEqual({
        active: ["p1"],
        subs: [],
        guests: ["Viejo Uno", "Juan Pérez"],
      })
    )
  })
})
