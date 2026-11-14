import { render, screen } from "@testing-library/react"
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
import { MediaReportDialog } from "@/features/player/components/MediaReportDialog"
import { renderWithQuery } from "@/test/render"

import { CardBackground, FramedAvatar } from "./cosmetics"
import { CustomPanel } from "./CustomPanel"
import { customDrawable, fileUrl, posterUrl, type Points } from "./types"

// Lo propio (bitácoras 2026-11-13-avatar-y-fondo-propios y 2026-11-14-inventario-de-lo-propio): el panel de la Tienda
// con lo guardado, la denuncia y cómo se dibuja.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const prices = { avatar: 550, background_animated: 650, background_static: 500 }
const avatar: Schemas["CustomMedia"] = {
  id: "11111111-1111-4111-8111-000000000001",
  kind: "avatar",
  animated: true,
  url: "https://db.test/storage/v1/object/public/cosmetics/u/avatar-1.webm",
  poster_url:
    "https://db.test/storage/v1/object/public/cosmetics/u/avatar-1.webp",
  price: 550,
  currency: "vip",
  created_at: "2026-11-14T12:00:00Z",
  equipped: true,
  visible: true,
}
const older: Schemas["CustomMedia"] = {
  ...avatar,
  id: "11111111-1111-4111-8111-000000000002",
  url: "https://db.test/storage/v1/object/public/cosmetics/u/avatar-0.webm",
  poster_url:
    "https://db.test/storage/v1/object/public/cosmetics/u/avatar-0.webp",
  created_at: "2026-11-10T12:00:00Z",
  equipped: false,
}
const points = (vip: boolean): Points => ({
  vip,
  has_player: true,
  points: { earned: 1000, granted: 0, spent: 0, balance: 1000, mixes: 50 },
  vip_coins: {
    earned: 600,
    granted: 0,
    spent: 0,
    balance: 600,
    mixes: 30,
    frozen: !vip,
  },
})
const mine = (over: Partial<Schemas["MyCustom"]> = {}) =>
  http.get(`${API}/api/v1/me/custom`, () =>
    HttpResponse.json({
      avatar: [],
      background: [],
      max: { avatar: 5, background: 5 },
      prices,
      animated_available: true,
      ...over,
    })
  )
const equipped = http.put(`${API}/api/v1/me/cosmetics`, () =>
  HttpResponse.json({
    frame: null,
    avatar: null,
    background: null,
    theme: null,
    name: null,
    stickers: [],
  })
)

describe("panel de lo propio", () => {
  it("avatar sin VIP: el botón lleva al VIP en vez de subir", async () => {
    server.use(mine())
    const onVip = vi.fn()
    const { user } = renderWithQuery(
      <CustomPanel
        kind="avatar"
        vip={false}
        points={points(false)}
        onVip={onVip}
      />
    )
    const btn = await screen.findByRole("button", {
      name: /Subir avatar · 550 VIP/,
    })
    await user.click(btn)
    expect(onVip).toHaveBeenCalled()
    expect(
      screen.getByText("Todavía no subiste un avatar.")
    ).toBeInTheDocument()
  })

  it("fondo de miniperfil: fijo con puntos para todos y animado con monedas VIP", async () => {
    server.use(mine())
    renderWithQuery(
      <CustomPanel
        kind="background"
        vip
        points={points(true)}
        onVip={() => {}}
      />
    )
    expect(
      await screen.findByRole("button", { name: /Subir fondo fijo · 500 pts/ })
    ).toBeEnabled()
    expect(
      screen.getByRole("button", { name: /Subir fondo animado · 650 VIP/ })
    ).toBeEnabled()
    expect(screen.getByText("Tus fondos de miniperfil")).toBeInTheDocument()
    expect(screen.getByText("0 de 5")).toBeInTheDocument()
  })

  it("sin ffmpeg en el servidor, lo animado no se puede subir", async () => {
    server.use(mine({ animated_available: false }))
    renderWithQuery(
      <CustomPanel kind="avatar" vip points={points(true)} onVip={() => {}} />
    )
    expect(
      await screen.findByRole("button", { name: /Subir avatar/ })
    ).toBeDisabled()
    expect(
      screen.getByText("La subida de animaciones no está disponible por ahora.")
    ).toBeInTheDocument()
  })

  it("lo guardado: el puesto marcado y volver a uno anterior sin pagar", async () => {
    let sent: unknown
    server.use(
      mine({ avatar: [avatar, older] }),
      http.put(`${API}/api/v1/me/cosmetics`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({
          frame: null,
          avatar: `custom:${older.id}`,
          background: null,
          theme: null,
          name: null,
          stickers: [],
        })
      })
    )
    const { user } = renderWithQuery(
      <CustomPanel kind="avatar" vip points={points(true)} onVip={() => {}} />
    )
    expect(await screen.findByText("2 de 5")).toBeInTheDocument()
    expect(screen.getByText("Puesto")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sacármelo" })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: "Ponérmelo" }))
    await vi.waitFor(() =>
      expect(sent).toEqual({ avatar: `custom:${older.id}` })
    )
  })

  it("sacárselo deja el avatar guardado; borrar pide confirmación", async () => {
    let sent: unknown
    server.use(
      mine({ avatar: [avatar] }),
      http.put(`${API}/api/v1/me/cosmetics`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({
          frame: null,
          avatar: null,
          background: null,
          theme: null,
          name: null,
          stickers: [],
        })
      })
    )
    const { user } = renderWithQuery(
      <CustomPanel kind="avatar" vip points={points(true)} onVip={() => {}} />
    )
    await user.click(await screen.findByRole("button", { name: "Sacármelo" }))
    await vi.waitFor(() => expect(sent).toEqual({ avatar: null }))
    await user.click(screen.getByRole("button", { name: "Borrar" }))
    expect(
      await screen.findByText(/no se devuelve lo que pagaste/)
    ).toBeInTheDocument()
    expect(screen.getByText(/te lo sacamos/)).toBeInTheDocument()
  })

  it("con el tope lleno no deja subir", async () => {
    server.use(
      mine({ avatar: [avatar, older], max: { avatar: 2, background: 5 } }),
      equipped
    )
    renderWithQuery(
      <CustomPanel kind="avatar" vip points={points(true)} onVip={() => {}} />
    )
    expect(
      await screen.findByRole("button", { name: /Subir avatar/ })
    ).toBeDisabled()
    expect(
      screen.getByText(
        "Llegaste a 2 avatares guardados: borra uno para subir otro."
      )
    ).toBeInTheDocument()
  })

  it("con el VIP vencido, el animado queda guardado pero no se puede poner", async () => {
    server.use(
      mine({ avatar: [{ ...avatar, visible: false, equipped: false }] })
    )
    renderWithQuery(
      <CustomPanel
        kind="avatar"
        vip={false}
        points={points(false)}
        onVip={() => {}}
      />
    )
    expect(await screen.findByText(/Vuelve siendo VIP/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ponérmelo" })).toBeDisabled()
  })
})

describe("lo propio al dibujarlo", () => {
  it("usa la url subida en vez de /cosmetics/, y su imagen fija", () => {
    const d = customDrawable(avatar)!
    expect(d).toMatchObject({ id: "custom", kind: "avatar", file: null })
    expect(fileUrl(d)).toBe(avatar.url)
    expect(posterUrl(d)).toBe(avatar.poster_url)
    expect(customDrawable({ ...avatar, visible: false })).toBeNull()
  })

  it("el avatar propio es video en la ficha", () => {
    const { container } = render(
      <FramedAvatar
        alias="kyan"
        src="/foto.png"
        avatar={customDrawable(avatar)}
        size={120}
      />
    )
    expect(container.querySelector("video")).toHaveAttribute("src", avatar.url)
  })

  it("el fondo animado es video y el fijo, imagen", () => {
    const { container, rerender } = render(
      <CardBackground src="https://x/f.webm" poster="https://x/f.webp" />
    )
    expect(container.querySelector("video")).toHaveAttribute(
      "poster",
      "https://x/f.webp"
    )
    rerender(<CardBackground src="https://x/f.jpg" />)
    expect(container.querySelector("video")).toBeNull()
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://x/f.jpg"
    )
  })
})

describe("denunciar una imagen", () => {
  it("sin imágenes propias ni portada no se muestra", () => {
    const { container } = renderWithQuery(
      <MediaReportDialog player="p" nick="kyan" kinds={[]} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("manda qué imagen, el motivo y la nota", async () => {
    let sent: unknown
    server.use(
      http.post(
        `${API}/api/v1/players/p1/media-reports`,
        async ({ request }) => {
          sent = await request.json()
          return new HttpResponse(null, { status: 204 })
        }
      )
    )
    const { user } = renderWithQuery(
      <MediaReportDialog player="p1" nick="kyan" kinds={["avatar", "cover"]} />
    )
    await user.click(screen.getByRole("button", { name: /Denunciar imagen/ }))
    await user.click(screen.getByRole("radio", { name: "Su portada" }))
    await user.click(screen.getByRole("radio", { name: "Contenido ofensivo" }))
    await user.type(screen.getByLabelText("Nota (opcional)"), "un insulto")
    await user.click(screen.getByRole("button", { name: "Enviar denuncia" }))
    await vi.waitFor(() =>
      expect(sent).toEqual({
        kind: "cover",
        reason: "offensive",
        note: "un insulto",
      })
    )
  })
})
