import { QueryClient } from "@tanstack/react-query"
import { beforeEach, describe, expect, it } from "vitest"

import { profileKeys } from "@/features/profile/queries"
import {
  claimKeys,
  markWelcomeSeen,
  needsWelcome,
  onboardingFrom,
  type MyProfile,
  type SteamStatus,
} from "./queries"

const profile = (gameRole: string | null) =>
  ({ details: { game_role: gameRole } }) as unknown as MyProfile
const steam = (ids: string[]) =>
  ({
    steam_ids: ids.map((steam_id, i) => ({ steam_id, is_primary: i === 0 })),
    max_steam_ids: 4,
    last_code: null,
    pending_requests: 0,
  }) as SteamStatus

describe("onboardingFrom", () => {
  it("cuenta puesto y vinculación", () => {
    expect(onboardingFrom(profile(null), steam([]))).toEqual({
      style: false,
      linked: false,
      done: 0,
      complete: false,
    })
    expect(onboardingFrom(profile("AWPer"), steam(["7656"]))).toMatchObject({
      done: 2,
      complete: true,
    })
    expect(onboardingFrom(profile(null), steam(["7656"]))).toMatchObject({
      style: false,
      linked: true,
      done: 1,
    })
  })
})

describe("needsWelcome", () => {
  let queryClient: QueryClient
  beforeEach(() => {
    localStorage.clear()
    queryClient = new QueryClient()
  })

  it("sí cuando falta algo y todavía no se mostró", async () => {
    queryClient.setQueryData(profileKeys.mine, profile(null))
    queryClient.setQueryData(claimKeys.status, steam([]))
    expect(await needsWelcome(queryClient, "u1")).toBe(true)
  })

  it("no si ya se mostró en este navegador", async () => {
    queryClient.setQueryData(profileKeys.mine, profile(null))
    queryClient.setQueryData(claimKeys.status, steam([]))
    markWelcomeSeen("u1")
    expect(await needsWelcome(queryClient, "u1")).toBe(false)
    expect(await needsWelcome(queryClient, "otro")).toBe(true)
  })

  it("no si el perfil ya está completo", async () => {
    queryClient.setQueryData(profileKeys.mine, profile("IGL"))
    queryClient.setQueryData(claimKeys.status, steam(["7656"]))
    expect(await needsWelcome(queryClient, "u1")).toBe(false)
  })
})
