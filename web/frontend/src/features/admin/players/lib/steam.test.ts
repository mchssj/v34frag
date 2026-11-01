import { describe, expect, it } from "vitest"

import { requestBlock } from "./steam"
import type { SteamRequest } from "../types"

describe("Pedidos de SteamID", () => {
  const req = (o: Partial<SteamRequest>): SteamRequest =>
    ({
      id: 1,
      kind: "add",
      steam_id: "76561198000000001",
      nick: null,
      status: "pending",
      note: null,
      reason: null,
      created_at: "2026-10-28T00:00:00Z",
      resolved_at: null,
      player: { id: "p", nick: "Tiza" },
      user: null,
      server: null,
      matches: 3,
      player_steam_count: 2,
      shares_match: false,
      ...o,
    }) as SteamRequest

  it("no se aprueba si comparte partidas o si es el único SteamID", () => {
    expect(requestBlock(req({}))).toBeNull()
    expect(requestBlock(req({ shares_match: true }))).not.toBeNull()
    expect(
      requestBlock(req({ kind: "remove", player_steam_count: 1 }))
    ).not.toBeNull()
    expect(
      requestBlock(req({ shares_match: true, status: "rejected" }))
    ).toBeNull()
  })
})
