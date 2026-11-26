import { afterEach, describe, expect, it, vi } from "vitest"

import { inLauncher, launchOnClick } from "./launcher"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

describe("launchOnClick fuera del launcher", () => {
  afterEach(() => vi.restoreAllMocks())

  it("no abre steam:// y copia el connect con la contraseña", async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: write },
      configurable: true,
    })
    const e = { preventDefault: vi.fn() }
    expect(inLauncher()).toBe(false)
    launchOnClick("1.2.3.4:27015", "abc")(e)
    expect(e.preventDefault).toHaveBeenCalled()
    await vi.waitFor(() =>
      expect(write).toHaveBeenCalledWith("connect 1.2.3.4:27015; password abc")
    )
  })

  it("sin contraseña (SourceTV), solo el connect", async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: write },
      configurable: true,
    })
    launchOnClick("1.2.3.4:27065")({ preventDefault: vi.fn() })
    await vi.waitFor(() =>
      expect(write).toHaveBeenCalledWith("connect 1.2.3.4:27065")
    )
  })
})
