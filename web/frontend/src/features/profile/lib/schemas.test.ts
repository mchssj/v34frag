import { describe, expect, it } from "vitest"

import { socialsSchema } from "./schemas"

const parse = (v: Partial<Record<"discord" | "steam" | "faceit", string>>) =>
  socialsSchema.safeParse({ discord: "", steam: "", faceit: "", ...v })

describe("socialsSchema", () => {
  it("Discord: quita el #1234 de las cuentas viejas y pasa a minúsculas", () => {
    expect(parse({ discord: "Zeta.CS#1234" }).data?.discord).toBe("zeta.cs")
    expect(parse({ discord: "a" }).success).toBe(false)
    expect(parse({ discord: "con espacio" }).success).toBe(false)
  })

  it("FACEIT: del link queda el nick", () => {
    expect(
      parse({ faceit: "https://www.faceit.com/es/players/Zeta_CS" }).data
        ?.faceit
    ).toBe("Zeta_CS")
    expect(parse({ faceit: "Zeta_CS" }).data?.faceit).toBe("Zeta_CS")
    expect(parse({ faceit: "https://otro.com/x" }).success).toBe(false)
  })

  it("Steam: solo el link del perfil, normalizado a https y sin www", () => {
    expect(parse({ steam: "steamcommunity.com/id/zeta_cs/" }).data?.steam).toBe(
      "https://steamcommunity.com/id/zeta_cs"
    )
    expect(
      parse({
        steam: "http://www.steamcommunity.com/profiles/76561198034418820",
      }).data?.steam
    ).toBe("https://steamcommunity.com/profiles/76561198034418820")
    // El SteamID y el nombre suelto ya no: el SteamID se vincula con !claim.
    for (const steam of [
      "76561198034418820",
      "zeta_cs",
      "https://steamcommunity.com/groups/x",
    ])
      expect(parse({ steam }).success).toBe(false)
  })

  it("todo vacío es válido (son opcionales)", () => {
    expect(parse({}).success).toBe(true)
  })
})
