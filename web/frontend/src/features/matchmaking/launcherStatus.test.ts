import { describe, expect, it } from "vitest"

import { launcherStatusOf } from "./MatchAlerts"
import type { MmLobby } from "./types"

const lobby = (over: Partial<MmLobby>) =>
  ({
    mode: "5v5",
    map: "de_dust2",
    status: "veto",
    match: null,
    ...over,
  }) as MmLobby

describe("launcherStatusOf", () => {
  it("sin cola ni sala", () => {
    expect(launcherStatusOf({ queue: null, lobby: null })).toEqual({
      state: "idle",
    })
    expect(launcherStatusOf(undefined)).toEqual({ state: "idle" })
  })

  it("en la cola, con desde cuándo", () => {
    const joined_at = "2026-11-25T15:00:00.000Z"
    expect(
      launcherStatusOf({ queue: { mode: "2v2", joined_at }, lobby: null })
    ).toEqual({
      state: "queue",
      mode: "2v2",
      since: Date.parse(joined_at),
    })
  })

  it("la sala manda sobre la cola", () => {
    const queue = { mode: "5v5", joined_at: "2026-11-25T15:00:00.000Z" }
    expect(
      launcherStatusOf({ queue, lobby: lobby({ status: "accepting" }) }).state
    ).toBe("found")
    expect(
      launcherStatusOf({ queue, lobby: lobby({ status: "assigned" }) })
    ).toEqual({
      state: "lobby",
      mode: "5v5",
      map: "de_dust2",
    })
  })

  it("en vivo, con el resultado", () => {
    const match = { score1: 9, score2: 7 } as MmLobby["match"]
    expect(
      launcherStatusOf({ queue: null, lobby: lobby({ status: "live", match }) })
    ).toEqual({
      state: "live",
      mode: "5v5",
      map: "de_dust2",
      score: "9-7",
    })
  })

  it("una sala terminada no cuenta", () => {
    expect(
      launcherStatusOf({ queue: null, lobby: lobby({ status: "finished" }) })
    ).toEqual({ state: "idle" })
  })
})
