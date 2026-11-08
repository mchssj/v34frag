import { screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { renderWithRouter } from "@/test/renderWithRouter"
import { StaffPage } from "./StaffPage"

// La página del Equipo (replanteo 87).
const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const card = (nick: string, i: number) => ({
  player_id: `00000000-0000-4000-8000-00000000000${i}`,
  nick,
  photo_url: null,
  level: 6,
})

describe("página del Equipo", () => {
  it("admins, moderadores, VIP y la ventana de Cómo ser VIP", async () => {
    server.use(
      http.get(`${API}/api/v1/staff`, () =>
        HttpResponse.json({
          admins: [card("daniloev", 1), card("kyan", 2)],
          moderators: [card("aciart", 3)],
          vips: [{ ...card("romanxz", 4), since: "2026-10-26T00:00:00Z" }],
        })
      )
    )
    const { user } = await renderWithRouter(<StaffPage />)
    expect(await screen.findByText("2 admins")).toBeInTheDocument()
    expect(screen.getByText("1 moderador")).toBeInTheDocument()
    expect(screen.getByText("romanxz")).toBeInTheDocument()
    expect(screen.getByText(/VIP desde/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Cómo ser VIP" }))
    expect(
      await screen.findByRole("link", { name: /Abrir Discord/ })
    ).toHaveAttribute("href", "https://discord.gg/bn5Yxsh9tc")
  })
})
