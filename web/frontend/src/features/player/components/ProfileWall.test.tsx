import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { WallComments, type Wall } from "./ProfileWall"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

// El muro del perfil: denunciar un comentario y el aviso al baneado o bloqueado (replanteo 94).
const WALL: Wall = {
  likes: 0,
  dislikes: 0,
  my_vote: null,
  can_vote: true,
  is_owner: false,
  comments_open: true,
  can_comment: true,
  restriction: null,
  total: 2,
  items: [
    {
      id: "c1",
      body: "comentario ajeno",
      created_at: "2026-11-09T03:00:00+00:00",
      author: {
        player_id: "p1",
        nick: "otro",
        photo_url: null,
        level: 5,
        verified: null,
      },
      mine: false,
      can_report: true,
      can_delete: false,
    },
    {
      id: "c2",
      body: "comentario mío",
      created_at: "2026-11-09T02:00:00+00:00",
      author: {
        player_id: "p2",
        nick: "yo",
        photo_url: null,
        level: 5,
        verified: null,
      },
      mine: true,
      can_report: false,
      can_delete: true,
    },
  ],
}

const noop = () => {}
const sendOk = () => Promise.resolve()

describe("muro del perfil", () => {
  it("denunciar un comentario ajeno manda el motivo y la nota; el propio no tiene el botón", async () => {
    const onReport = vi.fn(() => Promise.resolve())
    render(
      <WallComments
        wall={WALL}
        onSend={sendOk}
        onDelete={noop}
        onSetOpen={noop}
        onReport={onReport}
      />
    )
    expect(
      screen.queryByRole("button", { name: "Denunciar el comentario de yo" })
    ).toBeNull()
    await userEvent.click(
      screen.getByRole("button", { name: "Denunciar el comentario de otro" })
    )
    await userEvent.click(
      screen.getByRole("radio", { name: "Spam o publicidad" })
    )
    await userEvent.type(screen.getByLabelText("Nota (opcional)"), "publicidad")
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar denuncia" })
    )
    expect(onReport).toHaveBeenCalledWith("c1", "spam", "publicidad")
  })

  it("sin onReport no hay botón de denunciar", () => {
    render(
      <WallComments
        wall={WALL}
        onSend={sendOk}
        onDelete={noop}
        onSetOpen={noop}
      />
    )
    expect(screen.queryByRole("button", { name: /Denunciar/ })).toBeNull()
  })

  it("con un baneo activo o bloqueado por el dueño, dice por qué no puede comentar", () => {
    const { rerender } = render(
      <WallComments
        wall={{ ...WALL, can_comment: false, restriction: "banned" }}
        onSend={sendOk}
        onDelete={noop}
        onSetOpen={noop}
      />
    )
    expect(
      screen.getByText(/Con un baneo activo no puedes comentar/)
    ).toBeTruthy()
    expect(screen.queryByText("Inicia sesión")).toBeNull()
    rerender(
      <WallComments
        wall={{ ...WALL, can_comment: false, restriction: "blocked" }}
        onSend={sendOk}
        onDelete={noop}
        onSetOpen={noop}
      />
    )
    expect(screen.getByText(/Este jugador te bloqueó/)).toBeTruthy()
  })

  it("sin sesión sigue pidiendo que la inicie", () => {
    render(
      <WallComments
        wall={{ ...WALL, can_comment: false }}
        onSend={sendOk}
        onDelete={noop}
        onSetOpen={noop}
      />
    )
    expect(screen.getByText("Inicia sesión")).toBeTruthy()
  })
})
