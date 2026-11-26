import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchLatestLauncher } from "./latest"

const respond = (body: unknown, ok = true) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify(body), { status: ok ? 200 : 404 })
    )

describe("fetchLatestLauncher", () => {
  afterEach(() => vi.restoreAllMocks())

  it("lee la versión y el instalador de Windows", async () => {
    respond({
      version: "0.2.0",
      pub_date: "2026-11-26T10:00:00Z",
      platforms: {
        "windows-x86_64": {
          url: "https://cmleague.lat/descargas/launcher/CMLeague_0.2.0_x64-setup.exe",
        },
      },
    })
    expect(await fetchLatestLauncher()).toEqual({
      version: "0.2.0",
      url: "https://cmleague.lat/descargas/launcher/CMLeague_0.2.0_x64-setup.exe",
      date: "2026-11-26T10:00:00Z",
    })
  })

  it("sin publicar", async () => {
    respond({}, false)
    expect(await fetchLatestLauncher()).toBeNull()
  })

  it("no acepta instaladores de otro dominio", async () => {
    respond({
      version: "9",
      platforms: { "windows-x86_64": { url: "https://otro.com/x.exe" } },
    })
    expect(await fetchLatestLauncher()).toBeNull()
  })
})
