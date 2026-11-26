import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
import { EmailDomainsTab } from "./EmailDomainsTab"
import type { EmailDomain } from "../types"

// Correos temporales bloqueados (replanteo 148, docs/bitacora/2026-11-26-correos-bloqueados).
const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

const dom = (o: Partial<EmailDomain> = {}): EmailDomain => ({
  domain: "mailinator.com",
  source: "lista",
  blocked: true,
  reason: "Lista pública de correos temporales",
  created_at: "2026-11-26T00:00:00Z",
  updated_at: "2026-11-26T00:00:00Z",
  ...o,
})
const envelope = (items: unknown[], total = items.length) => ({
  items,
  total,
  page: 1,
  per: 25,
  sort: "domain",
  order: "asc",
})
const listQuery = vi.fn()
const posted = vi.fn()
const deleted = vi.fn()

function api(items: EmailDomain[], accounts: unknown[] = []) {
  server.use(
    http.get(`${API}/api/v1/admin/email-domains`, ({ request }) => {
      listQuery(Object.fromEntries(new URL(request.url).searchParams))
      return HttpResponse.json(envelope(items, 10457))
    }),
    http.get(`${API}/api/v1/admin/email-domains/accounts`, () =>
      HttpResponse.json(envelope(accounts))
    ),
    http.post(`${API}/api/v1/admin/email-domains`, async ({ request }) => {
      const body = (await request.json()) as { domain: string }
      posted(body)
      return HttpResponse.json(dom({ domain: body.domain, source: "admin" }), {
        status: 201,
      })
    }),
    http.delete(`${API}/api/v1/admin/email-domains/:domain`, ({ params }) => {
      deleted(params.domain)
      return HttpResponse.json({ domain: params.domain, removed: false })
    })
  )
}

describe("EmailDomainsTab", () => {
  it("muestra los dominios con su origen y estado, y el total", async () => {
    api([dom(), dom({ domain: "okmail.com", blocked: false })])
    renderWithQuery(<EmailDomainsTab onOpenAccount={vi.fn()} />)
    expect(await screen.findByText("mailinator.com")).toBeInTheDocument()
    expect(screen.getByText("10.457 dominios")).toBeInTheDocument()
    const ok = screen.getByText("okmail.com").closest("tr")!
    expect(within(ok).getByText("Permitido")).toBeInTheDocument()
    expect(
      within(ok).getByRole("button", { name: "Volver a bloquear" })
    ).toBeInTheDocument()
  })

  it("el filtro Permitidos pide blocked=false", async () => {
    api([dom()])
    renderWithQuery(<EmailDomainsTab onOpenAccount={vi.fn()} />)
    await screen.findByText("mailinator.com")
    await userEvent.click(screen.getByRole("radio", { name: "Permitidos" }))
    await waitFor(() =>
      expect(listQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ blocked: "false" })
      )
    )
  })

  it("bloquear un dominio con su motivo", async () => {
    api([dom()])
    renderWithQuery(<EmailDomainsTab onOpenAccount={vi.fn()} />)
    await screen.findByText("mailinator.com")
    await userEvent.type(
      screen.getByPlaceholderText("anonmart.com"),
      "afronewz.com"
    )
    await userEvent.type(
      screen.getByPlaceholderText("Motivo (opcional)"),
      "Cheater"
    )
    await userEvent.click(screen.getByRole("button", { name: "Bloquear" }))
    await waitFor(() =>
      expect(posted).toHaveBeenCalledWith({
        domain: "afronewz.com",
        reason: "Cheater",
      })
    )
  })

  it("desbloquear uno de la lista pide confirmación", async () => {
    api([dom()])
    renderWithQuery(<EmailDomainsTab onOpenAccount={vi.fn()} />)
    await screen.findByText("mailinator.com")
    await userEvent.click(screen.getByRole("button", { name: "Desbloquear" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/queda permitido/)).toBeInTheDocument()
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Desbloquear" })
    )
    await waitFor(() => expect(deleted).toHaveBeenCalledWith("mailinator.com"))
  })

  it("las cuentas que ya usan un correo bloqueado abren la cuenta", async () => {
    const onOpen = vi.fn()
    api(
      [dom()],
      [
        {
          user_id: "11111111-1111-4111-8111-111111111111",
          email: "x@anonmart.com",
          alias: "Cheat",
          domain: "anonmart.com",
          created_at: "2026-11-20T00:00:00Z",
          confirmed: true,
          player_id: null,
          banned: false,
        },
      ]
    )
    renderWithQuery(<EmailDomainsTab onOpenAccount={onOpen} />)
    expect(await screen.findByText("x@anonmart.com")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Ver cuenta" }))
    expect(onOpen).toHaveBeenCalledWith({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Cheat",
    })
  })
})
