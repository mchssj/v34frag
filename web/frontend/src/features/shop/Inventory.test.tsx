import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { renderWithRouter } from "@/test/renderWithRouter"

import { ShopPage } from "./ShopPage"
import type { ShopItem } from "./types"

const API = "http://api.test"
const item = (o: Partial<ShopItem>): ShopItem => ({
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
  base_price: 300,
  vip_price: null,
  weekly: false,
  is_new: false,
  owned: false,
  usable: false,
  equipped: false,
  expires_at: null,
  ...o,
})
const items = [
  item({ id: "marco-mira", name: "Mira", owned: true, usable: true }),
  item({
    id: "marco-fuego",
    name: "Fuego",
    owned: true,
    usable: true,
    equipped: true,
  }),
  item({ id: "marco-c4", name: "C4 en oferta", weekly: true }),
]
const server = setupServer(
  http.get(`${API}/api/v1/auth/me`, () =>
    HttpResponse.json({ id: "u1", tag: "kyan", role: "user" })
  ),
  http.get(`${API}/api/v1/me/profile`, () =>
    HttpResponse.json({ player: null, details: { avatar_url: null } })
  ),
  http.get(`${API}/api/v1/shop/items`, () =>
    HttpResponse.json({
      items,
      total: items.length,
      page: 1,
      per: 400,
      sort: "sort",
      order: "asc",
      weekly_ends: "2026-11-23T03:00:00.000Z",
    })
  ),
  http.get(`${API}/api/v1/shop/config`, () =>
    HttpResponse.json({ weekly_discount: 20, per_mix: 10 })
  ),
  http.get(`${API}/api/v1/me/points`, () => {
    const w = { balance: 1000, earned: 1000, mixes: 10, granted: 0, spent: 0 }
    return HttpResponse.json({
      vip: false,
      has_player: true,
      points: w,
      vip_coins: { ...w, balance: 0 },
    })
  }),
  http.get(`${API}/api/v1/me/cosmetics`, () =>
    HttpResponse.json({
      frame: "marco-fuego",
      avatar: null,
      background: null,
      theme: null,
      name: null,
      stickers: [],
    })
  ),
  http.get(`${API}/api/v1/me/custom`, () =>
    HttpResponse.json({ avatar: [], background: [] })
  )
)
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("Inventario", () => {
  it("solo lo tuyo, lo puesto primero y sin lo de comprar", async () => {
    await renderWithRouter(<ShopPage mode="inventory" />)
    expect(
      await screen.findByRole("heading", { name: "Inventario" })
    ).toBeInTheDocument()
    const names = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent)
    expect(names).toEqual(["Fuego", "Mira"])
    expect(screen.queryByText("C4 en oferta")).toBeNull()
    expect(screen.queryByText("Ofertas de la semana")).toBeNull()
    expect(screen.queryByText("Puntos")).toBeNull()
    expect(screen.queryByLabelText("Mostrar")).toBeNull()
    expect(
      screen.getByRole("link", { name: /Ir a la tienda/ })
    ).toHaveAttribute("href", "/shop")
  })

  it("la tienda sigue mostrando todo", async () => {
    await renderWithRouter(<ShopPage />)
    expect(
      await screen.findByRole("heading", { name: "Tienda" })
    ).toBeInTheDocument()
    expect(screen.getByText("Ofertas de la semana")).toBeInTheDocument()
    expect(screen.getAllByText("C4 en oferta").length).toBeGreaterThan(0)
  })
})

describe("Mostrar › Nuevo", () => {
  const catalog = [
    item({ id: "marco-viejo", name: "Viejo" }),
    item({ id: "marco-nuevo", name: "Recién llegado", is_new: true }),
    item({
      id: "marco-nuevo-mio",
      name: "Nuevo pero mío",
      is_new: true,
      owned: true,
      usable: true,
    }),
    item({
      id: "tema-viejo",
      kind: "theme",
      name: "Tema viejo",
      file: null,
      css_class: "tema-terro",
    }),
  ]
  const names = () =>
    screen.queryAllByRole("heading", { level: 3 }).map((h) => h.textContent)

  it("solo lo que lleva la etiqueta Nuevo, por tipo, y avisa si no hay", async () => {
    server.use(
      http.get(`${API}/api/v1/shop/items`, () =>
        HttpResponse.json({
          items: catalog,
          total: catalog.length,
          page: 1,
          per: 400,
          sort: "sort",
          order: "asc",
          weekly_ends: "2026-11-23T03:00:00.000Z",
        })
      )
    )
    const user = userEvent.setup()
    await renderWithRouter(<ShopPage />)
    expect(await screen.findByText("Viejo")).toBeInTheDocument()
    await user.click(screen.getByLabelText("Mostrar"))
    await user.click(await screen.findByRole("option", { name: "Nuevo" }))
    expect(names()).toEqual(["Recién llegado"])
    expect(screen.getByText("1 artículos")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Temas/ }))
    expect(names()).toEqual([])
    expect(
      screen.getByText("No hay nada nuevo de este tipo por ahora.")
    ).toBeInTheDocument()
  })
})
