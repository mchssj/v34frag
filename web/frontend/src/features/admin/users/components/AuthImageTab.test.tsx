import { screen } from "@testing-library/react"
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
import { AuthImageTab } from "./AuthImageTab"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const API = "http://api.test"
const IMG = "https://x.test/storage/v1/object/public/photos/site/1.jpg"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("AuthImageTab", () => {
  it("sin imagen: ofrece subirla y no quitarla", async () => {
    server.use(
      http.get(`${API}/api/v1/site/auth-image`, () =>
        HttpResponse.json({ url: null })
      )
    )
    renderWithQuery(<AuthImageTab />)
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Subir imagen" })).toBeEnabled()
    )
    expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull()
  })

  it("con imagen: Quitar la borra y vuelve a 'Subir imagen'", async () => {
    const deleted = vi.fn()
    server.use(
      http.get(`${API}/api/v1/site/auth-image`, () =>
        HttpResponse.json({ url: IMG })
      ),
      http.delete(`${API}/api/v1/admin/site/auth-image`, () => {
        deleted()
        return HttpResponse.json({ url: null })
      })
    )
    const { user } = renderWithQuery(<AuthImageTab />)
    expect(
      await screen.findByRole("img", {
        name: "Imagen actual del inicio de sesión",
      })
    ).toHaveAttribute("src", IMG)
    await user.click(screen.getByRole("button", { name: "Quitar" }))
    expect(
      await screen.findByRole("button", { name: "Subir imagen" })
    ).toBeInTheDocument()
    expect(deleted).toHaveBeenCalledOnce()
    expect(screen.queryByRole("img")).toBeNull()
  })
})
