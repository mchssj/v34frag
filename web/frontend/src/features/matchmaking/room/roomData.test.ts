import { describe, expect, it } from "vitest"

import type { MmLobby, MmPlayer } from "../types"
import { chatScope, myTeam } from "./roomData"

const lobby = (players: Partial<MmPlayer>[], extra: Partial<MmLobby> = {}) =>
  ({ players: players as MmPlayer[], ...extra }) as MmLobby

describe("chatScope", () => {
  it("el de equipo debajo de mi lado y el general debajo del rival", () => {
    const l = lobby([
      { team: 1, is_me: false },
      { team: 2, is_me: true },
    ])
    expect(chatScope(l, 2)).toBe("team")
    expect(chatScope(l, 1)).toBe("all")
  })

  it("sin lado, un solo general (nunca dos)", () => {
    const l = lobby([{ team: 1, is_me: false }])
    expect(chatScope(l, 1)).toBeNull()
    expect(chatScope(l, 2)).toBe("all")
  })

  it("en una PCW manda el lado de la sala, aunque no esté en el roster", () => {
    const l = lobby([{ team: 2, is_me: false }], { my_team: 1 })
    expect(myTeam(l)).toBe(1)
    expect(chatScope(l, 1)).toBe("team")
    expect(chatScope(l, 2)).toBe("all")
    expect(
      myTeam(lobby([{ team: 1, is_me: true }], { my_team: null }))
    ).toBeNull()
  })
})
