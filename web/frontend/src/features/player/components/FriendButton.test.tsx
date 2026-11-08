import { screen, waitFor } from "@testing-library/react"
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
import { FriendButton, type Friendship } from "./FriendButton"

// El botón de amistad del perfil (replanteo 85).
const API = "http://api.test"
const ID = "77777777-7777-4777-8777-777777777777"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function api(initial: Friendship) {
  let status: Friendship = initial
  const calls = vi.fn()
  const done = (next: Friendship) => {
    status = next
    return HttpResponse.json({})
  }
  server.use(
    http.get(`${API}/api/v1/mm/friends/${ID}`, () =>
      HttpResponse.json({ status })
    ),
    http.post(`${API}/api/v1/mm/friends`, () => {
      calls("send")
      return done("sent")
    }),
    http.post(`${API}/api/v1/mm/friends/${ID}/accept`, () => {
      calls("accept")
      return done("friends")
    }),
    http.post(`${API}/api/v1/mm/friends/${ID}/reject`, () => {
      calls("reject")
      return done("none")
    }),
    http.delete(`${API}/api/v1/mm/friends/${ID}`, () => {
      calls("remove")
      return done("none")
    })
  )
  return calls
}

describe("botón de amistad del perfil", () => {
  it("Agregar amigo envía la solicitud y pasa a Solicitud enviada", async () => {
    const calls = api("none")
    renderWithQuery(<FriendButton playerId={ID} nick="romanxz" />)
    await userEvent.click(
      await screen.findByRole("button", { name: "Agregar amigo" })
    )
    expect(
      await screen.findByRole("button", { name: /Solicitud enviada/ })
    ).toBeInTheDocument()
    expect(calls).toHaveBeenCalledWith("send")
  })

  it("si te envió una, Aceptar los hace amigos", async () => {
    const calls = api("received")
    renderWithQuery(<FriendButton playerId={ID} nick="romanxz" />)
    await userEvent.click(
      await screen.findByRole("button", { name: "Aceptar" })
    )
    expect(
      await screen.findByRole("button", { name: /Amigos/ })
    ).toBeInTheDocument()
    expect(calls).toHaveBeenCalledWith("accept")
  })

  it("con uno mismo o sin poder enviar, no hay botón", async () => {
    api("unavailable")
    const { container } = renderWithQuery(
      <FriendButton playerId={ID} nick="romanxz" />
    )
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
