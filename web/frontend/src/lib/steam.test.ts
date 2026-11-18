import { describe, expect, it } from "vitest"
import { steam2, steam64 } from "./steam"

describe("steam2", () => {
  it("pasa un SteamID64 a STEAM_0", () => {
    expect(steam2("76561200642051412")).toBe("STEAM_0:0:1340892842")
    expect(steam2("76561197960265729")).toBe("STEAM_0:1:0")
  })
  it("deja igual lo que no es un SteamID64", () => {
    expect(steam2("STEAM_0:1:5")).toBe("STEAM_0:1:5")
    expect(steam2("abc")).toBe("abc")
    expect(steam2("76561197960265727")).toBe("76561197960265727")
  })
})

describe("steam64", () => {
  it("acepta SteamID64 y STEAM_X:Y:Z", () => {
    expect(steam64("76561200642051412")).toBe("76561200642051412")
    expect(steam64("STEAM_0:0:1340892842")).toBe("76561200642051412")
    expect(steam64("steam_1:1:0")).toBe("76561197960265729")
  })
  it("devuelve null con otra cosa", () => {
    expect(steam64("Nmz1-")).toBeNull()
    expect(steam64("STEAM_0:2:5")).toBeNull()
  })
})
