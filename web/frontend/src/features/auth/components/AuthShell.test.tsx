import { screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import type { ReactNode } from "react"
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
import { AuthShell } from "./AuthShell"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}))

const API = "http://api.test"
const IMG = "https://x.test/storage/v1/object/public/photos/site/1.jpg"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const panel = () => screen.getByRole("complementary")
const shell = () =>
  renderWithQuery(
    <AuthShell swap={{ label: "Crear cuenta", to: "/register" }} side={null}>
      <p>formulario</p>
    </AuthShell>
  )

describe("AuthShell", () => {
  it("con la imagen del admin, la muestra en el panel", async () => {
    server.use(
      http.get(`${API}/api/v1/site/auth-image`, () =>
        HttpResponse.json({ url: IMG })
      )
    )
    shell()
    await vi.waitFor(() =>
      expect(panel().querySelector("img")?.getAttribute("src")).toBe(IMG)
    )
  })

  it("sin imagen, el panel queda gris", async () => {
    const asked = vi.fn()
    server.use(
      http.get(`${API}/api/v1/site/auth-image`, () => {
        asked()
        return HttpResponse.json({ url: null })
      })
    )
    shell()
    await vi.waitFor(() => expect(asked).toHaveBeenCalled())
    expect(panel().querySelector("img")).toBeNull()
    expect(panel()).toHaveClass("bg-muted")
  })
})
