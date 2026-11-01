import { describe, expect, it } from "vitest"

import { crestText } from "./TeamCrest"

describe("crestText", () => {
  it("usa la sigla en mayúsculas", () => {
    expect(crestText({ name: "Furia Sur", tag: "fur" })).toBe("FUR")
  })
  it("sin sigla, las iniciales del nombre", () => {
    expect(crestText({ name: "Furia Sur", tag: "" })).toBe("FS")
    expect(crestText({ name: "OLDteam", tag: null })).toBe("OLD")
  })
})
