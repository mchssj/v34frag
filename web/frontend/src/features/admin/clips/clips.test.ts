import { describe, expect, it } from "vitest"

import {
  FACTORY_PRIORITIES,
  SAMPLE_PLAYS,
  clipConfigError,
  clipPatch,
  pickClips,
} from "./clips"
import type { ClipConfig } from "./queries"

const cfg: ClipConfig = {
  priorities: { ...FACTORY_PRIORITIES },
  per_player: 2,
  per_match: 5,
  vip_per_match: 1,
  split_gap_seconds: 8,
  pre_seconds: 2,
  post_seconds: 2,
}

describe("Clips", () => {
  it("el PATCH lleva solo lo que cambió (y solo los tipos que cambiaron)", () => {
    expect(clipPatch(cfg, cfg)).toEqual({})
    const draft = {
      ...cfg,
      per_match: 6,
      priorities: { ...cfg.priorities, "3k": 2 },
    }
    expect(clipPatch(cfg, draft)).toEqual({
      priorities: { "3k": 2 },
      per_match: 6,
    })
  })

  it("valida los rangos", () => {
    expect(clipConfigError(cfg)).toBeNull()
    expect(
      clipConfigError({ ...cfg, priorities: { ...cfg.priorities, ace: 0 } })
    ).toMatch(/1 a 99/)
    expect(clipConfigError({ ...cfg, vip_per_match: 11 })).toMatch(/VIP/)
  })

  it("elige por prioridad, con el tope por jugador y por partida, y el VIP aparte", () => {
    const { top, vip } = pickClips(SAMPLE_PLAYS, cfg)
    expect(top[0].type).toBe("ace")
    expect(top).toHaveLength(5)
    expect(top.filter((p) => p.player === "Sapo").length).toBeLessThanOrEqual(2)
    expect(vip.map((p) => p.player)).toEqual(["Halcón"])
    expect(pickClips(SAMPLE_PLAYS, { ...cfg, vip_per_match: 0 }).vip).toEqual(
      []
    )
  })
})
