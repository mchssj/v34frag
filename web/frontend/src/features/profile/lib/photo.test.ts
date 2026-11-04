import { describe, expect, it } from "vitest"

import { myPhotoUrl } from "./photo"

describe("myPhotoUrl", () => {
  it("la de la ficha le gana a la de la cuenta (como en la base)", () => {
    expect(
      myPhotoUrl({
        player: { photo_url: "ficha.jpg" },
        details: { avatar_url: "cuenta.jpg" },
      })
    ).toBe("ficha.jpg")
  })

  it("sin foto de ficha, la de la cuenta; sin ninguna, null", () => {
    expect(
      myPhotoUrl({
        player: { photo_url: null },
        details: { avatar_url: "cuenta.jpg" },
      })
    ).toBe("cuenta.jpg")
    expect(myPhotoUrl({ player: null, details: null })).toBeNull()
    expect(myPhotoUrl(undefined)).toBeNull()
  })
})
