import { screen, waitFor } from "@testing-library/react"
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
import { HudSection } from "./HudSection"
import type { AdminServer } from "./queries"

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

const CFG =
  'csstv_hud "1"\ncsstv_hud_host "hud.cmleague.lat"\ncsstv_hud_port "27501"\ncsstv_hud_key "a1b2c3d4e5f6a1b2c3d4e5f6"'

const srv = (hud: Partial<AdminServer["hud"]> = {}): AdminServer => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "flow",
  active: true,
  license_state: "ok",
  license_expires_at: null,
  allowed_ip: null,
  online: true,
  last_seen_at: null,
  last_ip: null,
  plugin_version: "2.5.0",
  connect_address: "190.104.34.3:27015",
  panel_server_id: null,
  mode: "mix",
  region: null,
  tv_port: 27064,
  matches: 18,
  last_match_at: null,
  created_at: "2026-10-01T00:00:00Z",
  hud: {
    port: 27501,
    enabled: true,
    key: "a1b2c3d4e5f6a1b2c3d4e5f6",
    can_enable: true,
    last_packet_at: new Date().toISOString(),
    receiving: true,
    streaming: [{ id: "u1", alias: "kyantares" }],
    cfg: CFG,
    ...hud,
  },
})

const put = vi.fn()
function api() {
  server.use(
    http.put(`${API}/api/v1/admin/servers/:id/hud`, async ({ request }) => {
      put(await request.json())
      return HttpResponse.json(srv())
    }),
    http.get(`${API}/api/v1/admin/servers`, () =>
      HttpResponse.json({ items: [], total: 0, page: 1, per: 20 })
    )
  )
}

describe("HUD de un servidor", () => {
  it("muestra el estado, quién transmite y las líneas del cfg", () => {
    renderWithQuery(<HudSection server={srv()} />)
    expect(screen.getByText("Recibiendo")).toBeInTheDocument()
    expect(screen.getByText("kyantares")).toBeInTheDocument()
    expect(screen.getByText(/csstv_hud_port "27501"/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Guardar HUD" })).toBeDisabled()
  })

  it("apagarlo manda el puerto y enabled false", async () => {
    api()
    const { user } = renderWithQuery(<HudSection server={srv()} />)
    await user.click(screen.getByRole("radio", { name: "Apagado" }))
    await user.click(screen.getByRole("button", { name: "Guardar HUD" }))
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith({ port: 27501, enabled: false })
    )
  })

  it("sin SourceTV avisa y no deja activarlo", () => {
    renderWithQuery(
      <HudSection
        server={srv({
          port: null,
          enabled: false,
          key: null,
          can_enable: false,
          receiving: false,
          streaming: [],
          cfg: null,
          last_packet_at: null,
        })}
      />
    )
    expect(
      screen.getByText(/carga arriba la dirección y el puerto de SourceTV/)
    ).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Activo" })).toBeDisabled()
    expect(screen.getByText("Sin HUD")).toBeInTheDocument()
  })

  it("un puerto fuera del rango no se puede guardar", async () => {
    const { user } = renderWithQuery(<HudSection server={srv()} />)
    const input = screen.getByLabelText("Puerto del relay")
    await user.clear(input)
    await user.type(input, "27600")
    expect(screen.getByRole("alert")).toHaveTextContent("entre 27500 y 27519")
    expect(screen.getByRole("button", { name: "Guardar HUD" })).toBeDisabled()
  })
})
