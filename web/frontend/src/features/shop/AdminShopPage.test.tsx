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

import type { Schemas } from "@/api/client"
import { renderWithQuery } from "@/test/render"

import { EditItemDialog } from "./AdminShopPage"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const item: Schemas["AdminShopItem"] = {
  id: "fondo-extra-cerezos",
  kind: "background",
  name: "Cerezos en flor",
  description: "Pétalos que caen.",
  file: "fondos/extra-cerezos.svg",
  css_class: null,
  collection: "anime",
  animated: true,
  vip_only: false,
  vip_reward: false,
  price: 450,
  vip_price: null,
  active: true,
  sort: 1,
  owners: 0,
}

describe("editar nombre y descripción", () => {
  it("manda solo lo que cambió y cierra", async () => {
    const sent = vi.fn()
    server.use(
      http.patch(
        `${API}/api/v1/admin/shop/items/fondo-extra-cerezos`,
        async ({ request }) => {
          const body = await request.json()
          sent(body)
          return HttpResponse.json({ ...item, ...(body as object) })
        }
      )
    )
    const onClose = vi.fn()
    const { user } = renderWithQuery(
      <EditItemDialog item={item} onClose={onClose} />
    )
    const save = screen.getByRole("button", { name: "Guardar" })
    expect(save).toBeDisabled()
    const name = screen.getByLabelText("Nombre")
    await user.clear(name)
    await user.type(name, "  Sakura  ")
    await user.click(save)
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(sent).toHaveBeenCalledWith({ name: "Sakura" })
  })

  it("la descripción vacía se manda como null y sin nombre no se guarda", async () => {
    const sent = vi.fn()
    server.use(
      http.patch(
        `${API}/api/v1/admin/shop/items/fondo-extra-cerezos`,
        async ({ request }) => {
          sent(await request.json())
          return HttpResponse.json(item)
        }
      )
    )
    const onClose = vi.fn()
    const { user } = renderWithQuery(
      <EditItemDialog item={item} onClose={onClose} />
    )
    await user.clear(screen.getByLabelText("Nombre"))
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
    await user.type(screen.getByLabelText("Nombre"), "Cerezos en flor")
    await user.clear(screen.getByLabelText("Descripción"))
    await user.click(screen.getByRole("button", { name: "Guardar" }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(sent).toHaveBeenCalledWith({ description: null })
  })

  it("pasar a solo VIP manda el precio en monedas VIP y avisa a quien lo tiene", async () => {
    const sent = vi.fn()
    server.use(
      http.patch(
        `${API}/api/v1/admin/shop/items/fondo-extra-cerezos`,
        async ({ request }) => {
          sent(await request.json())
          return HttpResponse.json(item)
        }
      )
    )
    const onClose = vi.fn()
    const { user } = renderWithQuery(
      <EditItemDialog item={{ ...item, owners: 3 }} onClose={onClose} />
    )
    expect(screen.queryByLabelText("Precio en monedas VIP")).toBeNull()
    await user.click(screen.getByRole("combobox", { name: "Para" }))
    await user.click(await screen.findByRole("option", { name: /Solo VIP/ }))
    const price = screen.getByLabelText("Precio en monedas VIP")
    expect(price).toHaveValue(450)
    expect(screen.getByText(/3 cuentas lo tienen/)).toBeInTheDocument()
    await user.clear(price)
    await user.type(price, "500")
    await user.click(screen.getByRole("button", { name: "Guardar" }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(sent).toHaveBeenCalledWith({ vip_only: true, vip_price: 500 })
  })

  it("el que viene con el VIP no cambia de grupo", () => {
    renderWithQuery(
      <EditItemDialog
        item={{ ...item, vip_only: true, vip_reward: true, price: null }}
        onClose={() => {}}
      />
    )
    expect(screen.getByRole("combobox", { name: "Para" })).toBeDisabled()
    expect(screen.getByText(/sigue siendo VIP/)).toBeInTheDocument()
  })
})
