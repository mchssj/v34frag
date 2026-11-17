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

import { CreateCodeDialog } from "./AdminCodesSection"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const API = "http://api.test"
const item = {
  id: "marco-mira",
  kind: "frame",
  name: "Mira",
  description: null,
  file: "marcos/mira.svg",
  css_class: null,
  collection: "cs",
  animated: false,
  vip_only: false,
  vip_reward: false,
  price: 300,
  vip_price: null,
  active: false,
  sort: 1,
  owners: 0,
}
const server = setupServer(
  http.get(`${API}/api/v1/shop/config`, () =>
    HttpResponse.json({ code_vip_free: true })
  ),
  http.get(`${API}/api/v1/admin/shop/items`, () =>
    HttpResponse.json({
      items: [item],
      total: 1,
      page: 1,
      per: 8,
      sort: "name",
      order: "asc",
    })
  )
)
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("nuevo código", () => {
  it("un artículo por un mes: manda el premio, los días y el sorteo", async () => {
    const sent = vi.fn()
    server.use(
      http.post(`${API}/api/v1/admin/codes`, async ({ request }) => {
        sent(await request.json())
        return HttpResponse.json(
          {
            batch_id: "00000000-0000-4000-8000-000000000001",
            codes: [
              {
                id: "00000000-0000-4000-8000-000000000002",
                code: "CML-AAAA-BBBB-CCCC",
              },
            ],
          },
          { status: 201 }
        )
      })
    )
    const onCreated = vi.fn()
    const { user } = renderWithQuery(
      <CreateCodeDialog onClose={vi.fn()} onCreated={onCreated} />
    )
    const generate = screen.getByRole("button", { name: "Generar" })
    expect(generate).toBeDisabled()
    await user.click(await screen.findByRole("button", { name: /Mira/ }))
    expect(screen.getByText(/No está en la tienda/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Por días" }))
    await user.click(screen.getByRole("button", { name: "1 mes" }))
    await user.type(screen.getByLabelText("Sorteo"), "Sorteo Discord")
    expect(
      screen.getByText(/1 código de Mira por 30 días · 1 uso cada uno/)
    ).toBeInTheDocument()
    await user.click(generate)
    expect(sent).toHaveBeenCalledWith({
      reward: "item",
      item: "marco-mira",
      days: 30,
      max_uses: 1,
      count: 1,
      label: "Sorteo Discord",
    })
    expect(onCreated).toHaveBeenCalledWith({
      codes: ["CML-AAAA-BBBB-CCCC"],
      prize: "Mira por 30 días",
      label: "Sorteo Discord",
    })
  })

  it("un código personalizado avisa y fija la cantidad en 1", async () => {
    const { user } = renderWithQuery(
      <CreateCodeDialog onClose={vi.fn()} onCreated={vi.fn()} />
    )
    await user.type(
      screen.getByLabelText("Código personalizado (opcional)"),
      "navidad 2026"
    )
    expect(
      screen.getByLabelText("Código personalizado (opcional)")
    ).toHaveValue("NAVIDAD2026")
    expect(screen.getByText(/se adivina más fácil/)).toBeInTheDocument()
    expect(screen.getByLabelText("Cuántos códigos")).toBeDisabled()
  })
})
