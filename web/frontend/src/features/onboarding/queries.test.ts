import { QueryClient } from "@tanstack/react-query"
import { beforeEach, describe, expect, it } from "vitest"

import { profileKeys } from "@/features/profile/queries"
import {
  claimKeys,
  markStepSaved,
  markWelcomeSeen,
  needsWelcome,
  onboardingFrom,
  welcomeSteps,
  type MyProfile,
  type SteamStatus,
} from "./queries"

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

describe("onboardingFrom", () => {
  it("cuenta los 4 pasos según los datos cargados", () => {
    expect(onboardingFrom(profile(), steam([]))).toEqual({
      photo: false,
      style: false,
      contacts: false,
      linked: false,
      done: 0,
      complete: false,
    })
    expect(onboardingFrom(profile(FULL), steam(["7656"]))).toMatchObject({
      done: 4,
      complete: true,
    })
    expect(
      onboardingFrom(profile({ avatar_url: "x", steam: "zeta" }), steam([]))
    ).toMatchObject({ photo: true, contacts: true, done: 2 })
  })

  it("Foto y Contactos guardados vacíos cuentan como hechos, por cuenta", () => {
    markStepSaved("u1", "photo")
    markStepSaved("u1", "contacts")
    expect(onboardingFrom(profile(), steam([]))).toMatchObject({
      photo: true,
      contacts: true,
      done: 2,
    })
    expect(onboardingFrom(profile({}, "otro"), steam([])).done).toBe(0)
  })
})

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

describe("welcomeSteps", () => {
  const steps = (details: Details, linked: boolean) =>
    welcomeSteps(
      onboardingFrom(profile(details), steam(linked ? ["7656"] : []))
    )

  it("solo los pasos que faltan, en orden", () => {
    expect(steps({}, false)).toEqual(["photo", "style", "contacts", "link"])
    expect(steps({ game_role: "IGL" }, true)).toEqual(["photo", "contacts"])
    expect(steps({ real_name: "M", discord: "z" }, false)).toEqual([
      "style",
      "link",
    ])
  })

  it("con todo completo quedan los tres pasos editables", () => {
    expect(steps(FULL, true)).toEqual(["photo", "style", "contacts"])
  })
})
