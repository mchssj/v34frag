import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { renderWithQuery } from "@/test/render"
import { AccountSection } from "./AccountSection"
import type { AdminUser } from "../types"

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

const ID = "22222222-2222-4222-8222-222222222222"
const user = (o: Partial<AdminUser> = {}): AdminUser => ({
  id: ID,
  alias: "nachinn",
  role: "user",
  alias_changed_at: null,
  player_id: null,
  steam_id: null,
  vip: null,
  streamer: false,
  ...o,
})

const calls = vi.fn()
function api(confirmed: boolean, sessions_closed = true) {
  const base = `${API}/api/v1/admin/users/:id`
  server.use(
    http.get(`${base}/account`, () =>
      HttpResponse.json({
        confirmed,
        last_sign_in_at: null,
        email: "jugador@ejemplo.com",
      })
    ),
    http.post(`${base}/resend-confirmation`, () => {
      calls("resend")
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${base}/send-password-reset`, () => {
      calls("reset")
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${base}/random-password`, () => {
      calls("random")
      return HttpResponse.json({
        password: "Abc23456789xyzQW",
        sessions_closed,
      })
    })
  )
}
const button = (name: string) => screen.getByRole("button", { name })

describe("acceso de la cuenta", () => {
  it("con el correo confirmado no se puede reenviar la activación", async () => {
    api(true)
    renderWithQuery(<AccountSection u={user()} />)
    expect(await screen.findByText("Correo confirmado")).toBeInTheDocument()
    expect(button("Reenviar activación")).toBeDisabled()
    expect(button("Enviar correo de contraseña")).toBeEnabled()
  })

  it("muestra el correo de la cuenta, sin campo para editarlo", async () => {
    api(true)
    renderWithQuery(<AccountSection u={user()} />)
    expect(await screen.findByText("jugador@ejemplo.com")).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("sin confirmar: reenviar pide confirmación y llama a la API", async () => {
    api(false)
    const { user: u } = renderWithQuery(<AccountSection u={user()} />)
    expect(await screen.findByText("Sin confirmar")).toBeInTheDocument()
    await u.click(button("Reenviar activación"))
    expect(calls).not.toHaveBeenCalled()
    const dialog = await screen.findByRole("alertdialog")
    await u.click(within(dialog).getByRole("button", { name: "Reenviar" }))
    await waitFor(() => expect(calls).toHaveBeenCalledWith("resend"))
  })

  it("envía el correo de contraseña", async () => {
    api(true)
    const { user: u } = renderWithQuery(<AccountSection u={user()} />)
    await u.click(button("Enviar correo de contraseña"))
    const dialog = await screen.findByRole("alertdialog")
    await u.click(within(dialog).getByRole("button", { name: "Enviar" }))
    await waitFor(() => expect(calls).toHaveBeenCalledWith("reset"))
  })

  it("la aleatoria se muestra una vez y desaparece al cerrar", async () => {
    api(true)
    const { user: u } = renderWithQuery(<AccountSection u={user()} />)
    await u.click(button("Contraseña aleatoria"))
    const confirm = await screen.findByRole("alertdialog")
    await u.click(
      within(confirm).getByRole("button", { name: "Cambiar contraseña" })
    )
    expect(await screen.findByText("Abc23456789xyzQW")).toBeInTheDocument()
    await u.click(screen.getByRole("button", { name: "Ya lo guardé" }))
    await waitFor(() =>
      expect(screen.queryByText("Abc23456789xyzQW")).not.toBeInTheDocument()
    )
  })

  it("avisa si no se pudieron cerrar las sesiones", async () => {
    api(true, false)
    const { user: u } = renderWithQuery(<AccountSection u={user()} />)
    await u.click(button("Contraseña aleatoria"))
    const confirm = await screen.findByRole("alertdialog")
    await u.click(
      within(confirm).getByRole("button", { name: "Cambiar contraseña" })
    )
    expect(
      await screen.findByText(/no se pudieron cerrar sus sesiones/)
    ).toBeInTheDocument()
  })

  it("a una cuenta admin no se le puede poner una aleatoria", async () => {
    api(true)
    renderWithQuery(<AccountSection u={user({ role: "admin" })} />)
    expect(button("Contraseña aleatoria")).toBeDisabled()
    expect(await screen.findByText(/La tuya se cambia/)).toBeInTheDocument()
  })
})
