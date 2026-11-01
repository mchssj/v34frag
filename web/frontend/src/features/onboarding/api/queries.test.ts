import { QueryClient } from "@tanstack/react-query"
import { beforeEach, describe, expect, it } from "vitest"

import { profileKeys } from "@/features/profile/api/queries"
import { claimKeys, needsWelcome } from "./queries"
import { markWelcomeSeen } from "../lib/onboarding"
import type { MyProfile, SteamStatus } from "../types"

type Details = Partial<{
  avatar_url: string
  real_name: string
  game_role: string
  discord: string
  steam: string
  faceit: string
}>

const profile = (details: Details = {}, id = "u1") =>
  ({ user: { id }, details }) as unknown as MyProfile
const steam = (ids: string[]) =>
  ({
    steam_ids: ids.map((steam_id, i) => ({ steam_id, is_primary: i === 0 })),
    max_steam_ids: 4,
    last_code: null,
    pending_requests: 0,
  }) as SteamStatus

const FULL: Details = {
  real_name: "Martín",
  game_role: "AWPer",
  discord: "zeta",
}

beforeEach(() => localStorage.clear())

describe("needsWelcome", () => {
  let queryClient: QueryClient
  beforeEach(() => {
    queryClient = new QueryClient()
  })

  it("sí cuando falta algo y todavía no se mostró", async () => {
    queryClient.setQueryData(profileKeys.mine, profile())
    queryClient.setQueryData(claimKeys.status, steam([]))
    expect(await needsWelcome(queryClient, "u1")).toBe(true)
  })

  it("no si ya se mostró en este navegador", async () => {
    queryClient.setQueryData(profileKeys.mine, profile())
    queryClient.setQueryData(claimKeys.status, steam([]))
    markWelcomeSeen("u1")
    expect(await needsWelcome(queryClient, "u1")).toBe(false)
    expect(await needsWelcome(queryClient, "otro")).toBe(true)
  })

  it("no si el perfil ya está completo", async () => {
    queryClient.setQueryData(profileKeys.mine, profile(FULL))
    queryClient.setQueryData(claimKeys.status, steam(["7656"]))
    expect(await needsWelcome(queryClient, "u1")).toBe(false)
  })
})
