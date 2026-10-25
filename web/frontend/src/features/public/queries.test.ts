import { describe, expect, it } from "vitest"

import { claimServer, SERVER_MODE, type ServerStatus } from "./queries"

const server = (over: Partial<ServerStatus>): ServerStatus => ({
  id: "s",
  name: "Servidor",
  address: "1.2.3.4:27015",
  tv_address: null,
  mode: null,
  region: null,
  online: true,
  ping_ms: 20,
  map: "de_dust2",
  players: 4,
  max_players: 12,
  bots: 0,
  live_matches: 0,
  ...over,
})

describe("claimServer", () => {
  it("prefiere un servidor de mix en línea", () => {
    const mix = server({ id: "mix", mode: "mix" })
    expect(claimServer([server({ id: "dm", mode: "deathmatch" }), mix])).toBe(
      mix
    )
  })

  it("sin mix, cualquiera en línea con IP", () => {
    const dm = server({ id: "dm", mode: "deathmatch" })
    expect(
      claimServer([server({ id: "off", mode: "mix", online: false }), dm])
    ).toBe(dm)
  })

  it("null si ninguno está en línea con IP", () => {
    expect(
      claimServer([
        server({ online: false }),
        server({ address: null, mode: "mix" }),
      ])
    ).toBeNull()
  })
})

describe("SERVER_MODE", () => {
  it("traduce todos los modos de la API", () => {
    expect(SERVER_MODE).toEqual({
      mix: "Mix",
      competitive: "Competitivo",
      public: "Público",
      deathmatch: "Deathmatch",
      retakes: "Retakes",
      practice: "Práctica",
    })
  })
})
