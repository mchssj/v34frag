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

import { RedeemDialog } from "./RedeemDialog"

const API = "http://api.test"
let codeVipFree = true
const server = setupServer(
  http.get(`${API}/api/v1/me/redemptions`, () =>
    HttpResponse.json({ items: [] })
  ),
  http.get(`${API}/api/v1/shop/config`, () =>
    HttpResponse.json({ code_vip_free: codeVipFree })
  ),
  http.get(`${API}/api/v1/me/points`, () => HttpResponse.json({ vip: false }))
)
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  codeVipFree = true
})
afterAll(() => server.close())

const open = () => renderWithQuery(<RedeemDialog open onOpenChange={vi.fn()} />)

describe("canjear un código", () => {
  it("da formato al escribir, manda el código en el cuerpo y muestra el premio", async () => {
    const sent = vi.fn()
    server.use(
      http.post(`${API}/api/v1/me/redeem`, async ({ request }) => {
        sent(new URL(request.url).search, await request.json())
        return HttpResponse.json({
          reward: "vip",
          item: null,
          amount: null,
          days: 7,
          until: "2030-01-08T00:00:00Z",
          label: "Sorteo",
        })
      })
    )
    const { user } = open()
    const input = screen.getByLabelText("Código")
    const button = screen.getByRole("button", { name: "Canjear" })
    expect(button).toBeDisabled()
    await user.type(input, "cml7k2mqx9p4htd")
    expect(input).toHaveValue("CML-7K2M-QX9P-4HTD")
    await user.click(button)
    expect(
      await screen.findByText("¡Canjeaste VIP por 7 días!")
    ).toBeInTheDocument()
    expect(sent).toHaveBeenCalledWith("", { code: "CML-7K2M-QX9P-4HTD" })
    expect(input).toHaveValue("")
  })

  it.each([
    [true, false],
    [false, true],
  ])(
    "un artículo VIP sin ser VIP (lo VIP de un código sin VIP: %s): avisa que está congelado: %s",
    async (free, warns) => {
      codeVipFree = free
      server.use(
        http.post(`${API}/api/v1/me/redeem`, () =>
          HttpResponse.json({
            reward: "item",
            item: {
              id: "sticker-ace",
              kind: "sticker",
              name: "ACE",
              file: "stickers/ace.webp",
              css_class: null,
              animated: true,
              vip_only: true,
            },
            amount: null,
            days: null,
            until: null,
            label: null,
          })
        )
      )
      const { user } = open()
      await user.type(screen.getByLabelText("Código"), "NAVIDAD-2026")
      await user.click(screen.getByRole("button", { name: "Canjear" }))
      expect(
        await screen.findByText("¡Canjeaste ACE para siempre!")
      ).toBeInTheDocument()
      if (warns)
        expect(
          await screen.findByText(/lo vas a poder usar cuando seas VIP/)
        ).toBeInTheDocument()
      else
        expect(
          screen.queryByText(/lo vas a poder usar cuando seas VIP/)
        ).not.toBeInTheDocument()
    }
  )

  it("muestra el motivo de la base según el código del error", async () => {
    server.use(
      http.post(`${API}/api/v1/me/redeem`, () =>
        HttpResponse.json(
          {
            error: {
              code: "CODE_ALREADY_REDEEMED",
              message: "Ya canjeaste ese código",
            },
          },
          { status: 409 }
        )
      )
    )
    const { user } = open()
    await user.type(screen.getByLabelText("Código"), "NAVIDAD-2026")
    await user.click(screen.getByRole("button", { name: "Canjear" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ya canjeaste ese código"
    )
  })

  it("bloqueado: dice cuánto falta y apaga el botón", async () => {
    server.use(
      http.post(`${API}/api/v1/me/redeem`, () =>
        HttpResponse.json(
          { error: { code: "RATE_LIMITED", message: "Espera" } },
          { status: 429, headers: { "Retry-After": "840" } }
        )
      )
    )
    const { user } = open()
    await user.type(screen.getByLabelText("Código"), "NOEXISTE1")
    await user.click(screen.getByRole("button", { name: "Canjear" }))
    expect(
      await screen.findByText(
        /Podrás volver a intentar en 14 minutos/,
        {},
        // con toda la suite en paralelo, el error y el bloqueo pueden tardar más del segundo por defecto
        { timeout: 4000 }
      )
    ).toHaveAttribute("role", "alert")
    expect(screen.getByRole("button", { name: "Canjear" })).toBeDisabled()
  })

  it("lista los canjes con lo que le queda y los revertidos", async () => {
    server.use(
      http.get(`${API}/api/v1/me/redemptions`, () =>
        HttpResponse.json({
          items: [
            {
              id: "1",
              reward: "points",
              item: null,
              amount: 500,
              days: null,
              redeemed_at: "2026-11-10T00:00:00Z",
              label: "Sorteo Discord",
              code_tail: "4HTD",
              until: null,
              reverted_at: "2026-11-11T00:00:00Z",
            },
          ],
        })
      )
    )
    open()
    expect(
      await screen.findByText(/Sorteo Discord · …4HTD · revertido/)
    ).toBeInTheDocument()
  })
})
