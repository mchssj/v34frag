import { screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithQuery } from "@/test/render"

// Administración › Anticheat › Servidores (replanteo 159): el modo de cada servidor.
const authFetch = vi.fn()
vi.mock("@/auth/authFetch", () => ({ authFetch: (...a: unknown[]) => authFetch(...a) }))

import { ServersTab } from "./AdminAnticheatTools"

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
const LIST = {
  items: [
    { server_id: "96bb5060-a639-483a-94ef-f15135c57b1b", name: "CM League #1", mode: "always", mm: false, updated_at: "2026-11-27T12:00:00Z" },
    { server_id: "9374340c-88fc-48ad-bdd6-766957671854", name: "CM League #2", mode: "off", mm: false, updated_at: null },
  ],
  total: 2,
  page: 1,
  per: 20,
  sort: "name",
  order: "asc",
}

describe("ServersTab", () => {
  beforeEach(() => {
    authFetch.mockReset()
    authFetch.mockImplementation(() => Promise.resolve(ok(LIST)))
  })

  it("muestra cada servidor con su modo", async () => {
    renderWithQuery(<ServersTab />)
    expect(await screen.findByText("CM League #1")).toBeInTheDocument()
    expect(screen.getByText("CM League #2")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Anticheat en CM League #1" })).toHaveTextContent("Siempre")
    expect(screen.getByRole("combobox", { name: "Anticheat en CM League #2" })).toHaveTextContent("No lo exige")
    expect(String(authFetch.mock.calls[0]?.[0])).toContain("/api/v1/admin/anticheat/servers?per=20&page=1&sort=name&order=asc")
  })

  it("filtra por modo en la API, no en el navegador", async () => {
    const { user } = renderWithQuery(<ServersTab />)
    await screen.findByText("CM League #1")
    const chips = screen.getAllByRole("radio", { name: "Siempre" })
    await user.click(chips[0]!)
    await waitFor(() => expect(authFetch.mock.calls.some((c) => String(c[0]).includes("&mode=always"))).toBe(true))
  })

  // "Solo en la partida" ya no se elige (Daniel, 2026-11-27): solo se muestra en un servidor que ya lo tenía.
  it("no ofrece Solo en la partida, pero muestra el servidor que lo tiene", async () => {
    authFetch.mockImplementation(() =>
      Promise.resolve(ok({ ...LIST, items: [{ ...LIST.items[0], name: "Demo", mode: "mixes" }], total: 1 }))
    )
    renderWithQuery(<ServersTab />)
    expect(await screen.findByRole("combobox", { name: "Anticheat en Demo" })).toHaveTextContent("Solo en la partida")
    expect(screen.queryByRole("radio", { name: "Solo en la partida" })).not.toBeInTheDocument()
  })

  // Los que toman salas siguen a "Anticheat obligatorio" del matchmaking (Daniel, 2026-11-27): se ven, no se cambian.
  it("un servidor del matchmaking muestra su modo sin poder cambiarlo", async () => {
    authFetch.mockImplementation(() =>
      Promise.resolve(ok({ ...LIST, items: [{ ...LIST.items[0], mm: true }, { ...LIST.items[1], mm: false }] }))
    )
    renderWithQuery(<ServersTab />)
    await screen.findByText("CM League #1")
    expect(screen.queryByRole("combobox", { name: "Anticheat en CM League #1" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Anticheat en CM League #1")).toHaveTextContent("SiempreLo decide el matchmaking")
    expect(screen.getByRole("combobox", { name: "Anticheat en CM League #2" })).toHaveTextContent("No lo exige")
  })
})
