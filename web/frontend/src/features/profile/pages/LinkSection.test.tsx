import { act, screen, within } from "@testing-library/react"
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

import { TooltipProvider } from "@/components/ui/tooltip"
import { renderWithQuery } from "@/test/render"
import { LinkSection } from "./LinkSection"

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
)
vi.mock("sonner", () => ({ toast }))

const API = "http://api.test"
const A = "76561198000000001"
const B = "76561198000000002"

type Code = {
  code: string
  status: "pending" | "used" | "expired"
  expires_at: string
  used_at: string | null
  used_steam_id: string | null
  result: string | null
}

type SteamExtra = { added_at?: string | null; unlink_pending?: boolean }

const status = (
  ids: string[],
  last_code: Code | null = null,
  max = 3,
  extra: SteamExtra[] = []
) => ({
  steam_ids: ids.map((steam_id, i) => ({
    steam_id,
    is_primary: i === 0,
    added_at: null,
    unlink_pending: false,
    ...extra[i],
  })),
  max_steam_ids: max,
  last_code,
  pending_requests: 0,
})
const pendingCode = (): Code => ({
  code: "K7P2QX",
  status: "pending",
  expires_at: new Date(Date.now() + 600_000).toISOString(),
  used_at: null,
  used_steam_id: null,
  result: null,
})
const request = (steam_id: string) => ({
  id: 1,
  kind: "add",
  steam_id,
  nick: "zeta",
  note: null,
  status: "pending",
  reason: null,
  created_at: new Date().toISOString(),
  resolved_at: null,
})
const list = (items: unknown[]) => ({
  items,
  total: items.length,
  page: 1,
  per: 100,
  sort: "created_at",
  order: "desc",
})

const server = setupServer(
  http.get(`${API}/api/v1/me/profile`, () =>
    HttpResponse.json({
      user: { id: "u1" },
      details: { discord: null, steam: null, faceit: null },
      preferences: { theme_fx: null },
    })
  )
)
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.useRealTimers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

function given(steam: object | (() => object), requests: unknown[] = []) {
  server.use(
    http.get(`${API}/api/v1/me/claim-code`, () =>
      HttpResponse.json(typeof steam === "function" ? steam() : steam)
    ),
    http.get(`${API}/api/v1/me/steam-requests`, () =>
      HttpResponse.json(list(requests))
    )
  )
}

const renderSection = () =>
  renderWithQuery(
    <TooltipProvider>
      <LinkSection />
    </TooltipProvider>
  )

const accountRows = async () =>
  within(
    await screen.findByRole("list", { name: "Cuentas de juego" })
  ).getAllByRole("listitem")

describe("LinkSection · Cuentas de juego", () => {
  it("sin cuentas: estado vacío y título de la primera", async () => {
    given(status([]))
    renderSection()
    expect(
      await screen.findByText("Todavía no vinculaste ninguna cuenta")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Vincula tu primera cuenta desde el juego")
    ).toBeInTheDocument()
    expect(screen.getByLabelText("0 de 3 cuentas vinculadas")).toBeVisible()
  })

  it("vinculadas con su fecha y pendientes de alta", async () => {
    given(
      status([A, B], null, 4, [
        { added_at: "2026-08-14T15:00:00Z" },
        { added_at: null },
      ]),
      [request("76561198000000003")]
    )
    renderSection()
    const rows = await accountRows()
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText("Principal")).toBeInTheDocument()
    expect(within(rows[0]).getByText("Vinculada ago 2026")).toBeInTheDocument()
    expect(
      within(rows[0]).queryByRole("button", { name: "Hacer principal" })
    ).toBeNull()
    expect(within(rows[1]).getByText("Fecha desconocida")).toBeInTheDocument()
    expect(
      within(rows[1]).getByRole("button", { name: "Hacer principal" })
    ).toBeEnabled()
    expect(
      within(rows[1]).getByRole("button", { name: "Desvincular" })
    ).toBeEnabled()
    expect(
      within(rows[2]).getByText("Pendiente de aprobación")
    ).toBeInTheDocument()
    expect(within(rows[2]).getByText(/como zeta/)).toBeInTheDocument()
    expect(screen.getByText("¿Quieres enlazar otro SteamID?")).toBeVisible()
  })

  it("el único SteamID no se puede desvincular", async () => {
    given(status([A]))
    renderSection()
    const [row] = await accountRows()
    expect(
      within(row).queryByRole("button", { name: "Desvincular" })
    ).toBeNull()
  })

  it("hacer principal: avisa el éxito y el rechazo del backend", async () => {
    given(status([A, B]))
    const primary = vi.fn()
    let reject = false
    server.use(
      http.post(`${API}/api/v1/me/steam/:steamid/primary`, ({ params }) => {
        primary(params.steamid)
        return reject
          ? HttpResponse.json(
              {
                error: {
                  code: "BUSINESS_RULE",
                  message:
                    "Ya cambiaste tu SteamID principal en las últimas 24 horas.",
                },
              },
              { status: 400 }
            )
          : new HttpResponse(null, { status: 204 })
      })
    )
    const { user: u } = renderSection()
    const rows = await accountRows()
    await u.click(
      within(rows[1]).getByRole("button", { name: "Hacer principal" })
    )
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Cuenta principal actualizada")
    )
    expect(primary).toHaveBeenCalledWith(B)

    reject = true
    await u.click(
      within(rows[1]).getByRole("button", { name: "Hacer principal" })
    )
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Ya cambiaste tu SteamID principal en las últimas 24 horas."
      )
    )
  })

  it("desvincular: confirma con motivo opcional y manda la solicitud", async () => {
    given(status([A, B]))
    const sent = vi.fn()
    server.use(
      http.post(
        `${API}/api/v1/me/steam/:steamid/unlink`,
        async ({ params, request: req }) => {
          sent(params.steamid, await req.json())
          return HttpResponse.json({ id: 9 }, { status: 201 })
        }
      )
    )
    const { user: u } = renderSection()
    const rows = await accountRows()

    // Cancelar no manda nada.
    await u.click(within(rows[1]).getByRole("button", { name: "Desvincular" }))
    const box = screen.getByRole("group", { name: `Desvincular ${B}` })
    expect(
      within(box).getByText("Un admin tiene que aprobar la desvinculación")
    ).toBeVisible()
    await u.click(within(box).getByRole("button", { name: "Cancelar" }))
    expect(screen.queryByRole("group", { name: `Desvincular ${B}` })).toBeNull()

    await u.click(within(rows[1]).getByRole("button", { name: "Desvincular" }))
    await u.type(screen.getByLabelText("¿Por qué? (opcional)"), "La vendí")
    await u.click(screen.getByRole("button", { name: "Enviar solicitud" }))
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Solicitud enviada")
    )
    expect(sent).toHaveBeenCalledTimes(1)
    expect(sent).toHaveBeenCalledWith(B, { reason: "La vendí" })
  })

  it("con el pedido en revisión: badge y 'Cancelar solicitud' lo cancela", async () => {
    let pending = true
    given(() => status([A, B], null, 3, [{}, { unlink_pending: pending }]))
    const cancelled = vi.fn()
    server.use(
      http.delete(`${API}/api/v1/me/steam/:steamid/unlink`, ({ params }) => {
        cancelled(params.steamid)
        pending = false
        return new HttpResponse(null, { status: 204 })
      })
    )
    const { user: u } = renderSection()
    const rows = await accountRows()
    expect(
      within(rows[1]).getByText("Desvinculación en revisión")
    ).toBeInTheDocument()
    expect(
      within(rows[1]).queryByRole("button", { name: "Hacer principal" })
    ).toBeNull()
    expect(
      within(rows[1]).queryByRole("button", { name: "Desvincular" })
    ).toBeNull()

    await u.click(
      within(rows[1]).getByRole("button", { name: "Cancelar solicitud" })
    )
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Solicitud cancelada")
    )
    expect(cancelled).toHaveBeenCalledWith(B)
    // Al recargar el estado, la cuenta vuelve a la normalidad.
    expect(
      await within(rows[1]).findByRole("button", { name: "Desvincular" })
    ).toBeEnabled()
    expect(within(rows[1]).queryByText("Desvinculación en revisión")).toBeNull()
  })

  it("en el tope de la API no ofrece enlazar otra", async () => {
    given(status([A], null, 2), [request(B)])
    renderSection()
    expect(
      await screen.findByText(
        "Llegaste al límite de 2 cuentas. Desvincula una para enlazar otra."
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Generar/ })).toBeNull()
  })

  it("detecta el !claim con el sondeo y avisa", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let linked = false
    given(() =>
      linked
        ? status([A], {
            ...pendingCode(),
            status: "used",
            used_steam_id: A,
            result: "Listo: tu cuenta quedó vinculada",
          })
        : status([], pendingCode())
    )
    renderSection()
    expect(await screen.findByText("!claim K7P2QX")).toBeInTheDocument()
    expect(screen.getByText(/Esperando que lo escribas/)).toBeInTheDocument()

    linked = true
    await act(() => vi.advanceTimersByTimeAsync(5100))
    expect(await screen.findByText(A)).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith(`Cuenta ${A} vinculada`, {
      description: undefined,
    })
    expect(screen.queryByText("!claim K7P2QX")).toBeNull()
  })

  it("un !claim rechazado muestra el mensaje del servidor", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let used = false
    given(() =>
      status(
        [],
        used
          ? {
              ...pendingCode(),
              status: "used",
              used_steam_id: B,
              result: "Ese SteamID pertenece a otra cuenta",
            }
          : pendingCode()
      )
    )
    renderSection()
    await screen.findByText("!claim K7P2QX")
    used = true
    await act(() => vi.advanceTimersByTimeAsync(5100))
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Ese SteamID pertenece a otra cuenta",
        { description: undefined }
      )
    )
  })
})
