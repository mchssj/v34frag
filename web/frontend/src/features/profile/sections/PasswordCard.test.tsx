import { screen, waitFor } from "@testing-library/react"
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

import { tokenStore } from "@/auth/tokenStore"
import { renderWithQuery } from "@/test/render"
import { PasswordCard } from "./PasswordCard"

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
)
vi.mock("sonner", () => ({ toast }))

const API = "http://api.test"
const sent = vi.fn()

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
  tokenStore.logout()
})
afterAll(() => server.close())

function answer(res: () => Response) {
  server.use(
    http.post(`${API}/api/v1/me/password`, async ({ request }) => {
      sent(await request.json())
      return res()
    })
  )
}

async function fill(
  u: ReturnType<typeof renderWithQuery>["user"],
  current: string,
  next: string,
  confirm = next
) {
  await u.click(screen.getByRole("button", { name: "Cambiar contraseña" }))
  await u.type(screen.getByLabelText("Contraseña actual"), current)
  await u.type(screen.getByLabelText("Contraseña nueva"), next)
  await u.type(screen.getByLabelText("Repite la contraseña nueva"), confirm)
}

describe("PasswordCard", () => {
  it("con datos inválidos no llama a la API y muestra los errores", async () => {
    answer(() => HttpResponse.json({}))
    const { user: u } = renderWithQuery(<PasswordCard />)
    await u.click(screen.getByRole("button", { name: "Cambiar contraseña" }))
    await u.type(screen.getByLabelText("Contraseña nueva"), "abc")
    await u.click(screen.getByRole("button", { name: "Guardar contraseña" }))
    expect(screen.getByText("Ingresa tu contraseña actual.")).toBeVisible()
    expect(
      screen.getByText(
        "Muy débil. Usa al menos 8 caracteres, con números o mayúsculas."
      )
    ).toBeVisible()
    expect(sent).not.toHaveBeenCalled()
  })

  it("el ojo muestra los tres campos a la vez", async () => {
    const { user: u } = renderWithQuery(<PasswordCard />)
    await u.click(screen.getByRole("button", { name: "Cambiar contraseña" }))
    await u.click(
      screen.getAllByRole("button", { name: "Mostrar contraseña" })[0]
    )
    for (const label of [
      "Contraseña actual",
      "Contraseña nueva",
      "Repite la contraseña nueva",
    ])
      expect(screen.getByLabelText(label)).toHaveAttribute("type", "text")
  })

  it("WRONG_PASSWORD marca la actual y se borra al escribir", async () => {
    answer(() =>
      HttpResponse.json(
        {
          error: {
            code: "WRONG_PASSWORD",
            message: "La contraseña actual no es correcta.",
          },
        },
        { status: 400 }
      )
    )
    const { user: u } = renderWithQuery(<PasswordCard />)
    await fill(u, "mal-1234", "Nueva-1234")
    await u.click(screen.getByRole("button", { name: "Guardar contraseña" }))
    expect(
      await screen.findByText("La contraseña actual no es correcta.")
    ).toBeVisible()
    expect(screen.getByLabelText("Contraseña actual")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
    await u.type(screen.getByLabelText("Contraseña actual"), "x")
    expect(
      screen.queryByText("La contraseña actual no es correcta.")
    ).toBeNull()
  })

  it("éxito: guarda la sesión nueva, cierra el formulario y avisa", async () => {
    answer(() =>
      HttpResponse.json({
        access_token: "nuevo",
        refresh_token: "r-nuevo",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: "u1",
          email: "x@y.co",
          tag: "Mecha",
          role: "user",
          created_at: null,
          password_changed_at: new Date().toISOString(),
        },
      })
    )
    const { user: u } = renderWithQuery(<PasswordCard />)
    // Sin fecha guardada (no la cambió desde el 2026-10-19) no se muestra la línea.
    expect(screen.queryByText(/^Último cambio/)).toBeNull()
    await fill(u, "vieja-123", "Nueva-1234")
    expect(screen.getByText("Coinciden")).toBeVisible()
    await u.click(screen.getByRole("button", { name: "Guardar contraseña" }))
    await waitFor(() =>
      expect(tokenStore.getState().session?.accessToken).toBe("nuevo")
    )
    expect(sent).toHaveBeenCalledWith({
      current_password: "vieja-123",
      new_password: "Nueva-1234",
    })
    expect(toast.success).toHaveBeenCalledWith(
      "Contraseña actualizada · cerramos las otras sesiones"
    )
    expect(
      screen.getByRole("button", { name: "Cambiar contraseña" })
    ).toBeVisible()
    // La sesión nueva trae la fecha del cambio.
    expect(
      await screen.findByText("Último cambio hace un momento")
    ).toBeVisible()
  })
})
