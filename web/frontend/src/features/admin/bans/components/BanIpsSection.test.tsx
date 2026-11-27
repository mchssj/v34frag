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
import { BanIpsSection, ipOptions } from "./BanIpsSection"

// Baneo por IP (replanteo 149, docs/bitacora/2026-11-26-baneo-por-ip).
const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

const BAN = "0b0b0b0b-0000-4000-8000-000000000001"
const PLAYER = "dddddddd-0000-4000-8000-000000000001"
const page = (items: unknown[]) => ({
  items,
  total: items.length,
  page: 1,
  per: 50,
  sort: "last_seen_at",
  order: "desc",
})
const put = vi.fn()
const rangeAsked = vi.fn()

function api() {
  server.use(
    http.get(`${API}/api/v1/admin/bans/:id/ips`, () =>
      HttpResponse.json(
        page([
          {
            id: "11111111-1111-4111-8111-111111111111",
            ip: "198.51.100.9",
            expires_at: "2026-12-26T00:00:00Z",
            created_at: "2026-11-26T00:00:00Z",
            created_by_alias: "Daniel",
            active: true,
            exceptions: [],
          },
        ])
      )
    ),
    http.get(`${API}/api/v1/admin/ip-candidates`, () =>
      HttpResponse.json(
        page([
          {
            ip: "181.45.10.77",
            sources: ["servidor", "web"],
            first_seen_at: "2026-11-20T00:00:00Z",
            last_seen_at: "2026-11-26T00:00:00Z",
            others: [{ player_id: null, alias: "Tormenta" }],
            banned: false,
          },
        ])
      )
    ),
    http.get(`${API}/api/v1/admin/ip-ranges/accounts`, ({ request }) => {
      rangeAsked(new URL(request.url).searchParams.get("range"))
      return HttpResponse.json(
        page([
          {
            player_id: PLAYER,
            user_id: null,
            alias: "Cheater",
            banned: true,
            sources: ["web"],
            ips: 1,
            last_seen_at: "2026-11-26T00:00:00Z",
          },
          {
            player_id: null,
            user_id: "ffffffff-0000-4000-8000-000000000001",
            alias: "Tormenta",
            banned: false,
            sources: ["web"],
            ips: 1,
            last_seen_at: "2026-11-25T00:00:00Z",
          },
          {
            player_id: "eeeeeeee-0000-4000-8000-000000000001",
            user_id: "eeeeeeee-1111-4000-8000-000000000001",
            alias: "GabeV",
            banned: false,
            sources: ["servidor"],
            ips: 2,
            last_seen_at: "2026-11-24T00:00:00Z",
          },
        ])
      )
    }),
    http.post(`${API}/api/v1/admin/bans/:id/ip`, async ({ request }) => {
      put(await request.json())
      return HttpResponse.json(
        { id: "22222222-2222-4222-8222-222222222222" },
        { status: 201 }
      )
    })
  )
}

describe("ipOptions", () => {
  it("IPv4: la IP, su /24 y su /16; IPv6: solo la IP", () => {
    expect(ipOptions("181.45.10.77").map((o) => o.value)).toEqual([
      "181.45.10.77",
      "181.45.10.0/24",
      "181.45.0.0/16",
    ])
    expect(ipOptions("2001:db8::5")).toHaveLength(1)
  })
})

describe("BanIpsSection", () => {
  it("elegir el /16 propone exceptuar a los que no están baneados; se puede desmarcar a uno", async () => {
    api()
    renderWithQuery(
      <BanIpsSection
        banId={BAN}
        playerId={PLAYER}
        playerAlias="Cheater"
        banExpiresAt={new Date(Date.now() + 10 * 86_400_000).toISOString()}
      />
    )
    expect(await screen.findByText("198.51.100.9")).toBeInTheDocument()
    expect(screen.getByText(/También la usaron: Tormenta/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "181.45.*.*" }))
    const region = await screen.findByRole("region", { name: "A quién afecta" })
    expect(rangeAsked).toHaveBeenLastCalledWith("181.45.0.0/16")
    expect(
      await within(region).findByText(/Otros 2 jugadores usaron/)
    ).toBeInTheDocument()
    const gabe = within(region).getByRole("checkbox", {
      name: "Exceptuar a GabeV",
    })
    const torm = within(region).getByRole("checkbox", {
      name: "Exceptuar a Tormenta",
    })
    expect(gabe).toBeChecked()
    expect(torm).toBeChecked()
    // Tormenta es otra cuenta del cheater: se desmarca.
    await userEvent.click(torm)
    await userEvent.click(
      within(region).getByRole("button", { name: "Banear 181.45.0.0/16" })
    )
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith({
        ip: "181.45.0.0/16",
        except_players: ["eeeeeeee-0000-4000-8000-000000000001"],
        except_users: [],
        full: false,
      })
    )
    // El baneo vence antes de 30 días: no hay que elegir duración.
    expect(
      within(region).queryByRole("radiogroup", { name: "Duración de la IP" })
    ).not.toBeInTheDocument()
  })

  it("con un baneo permanente, la IP puede ser permanente (replanteo 153)", async () => {
    api()
    renderWithQuery(
      <BanIpsSection
        banId={BAN}
        playerId={PLAYER}
        playerAlias="Cheater"
        banExpiresAt={null}
      />
    )
    await screen.findByText("198.51.100.9")
    await userEvent.click(screen.getByRole("button", { name: "Esta IP" }))
    const region = await screen.findByRole("region", { name: "A quién afecta" })
    expect(
      within(region).getByRole("radio", { name: "30 días" })
    ).toHaveAttribute("aria-checked", "true")
    await userEvent.click(
      within(region).getByRole("radio", { name: "Permanente, como el baneo" })
    )
    await userEvent.click(
      await within(region).findByRole("button", { name: /^Banear / })
    )
    await waitFor(() =>
      expect(put).toHaveBeenLastCalledWith(
        expect.objectContaining({ full: true })
      )
    )
  })
})
