import { describe, expect, it } from "vitest"

import { serverWarnings } from "./servers"
import { server } from "./test-server"

describe("Servidores", () => {
  it("sin avisos si está al día", () => {
    expect(serverWarnings(server(), "2.5.0")).toEqual([])
  })

  it("avisa sin señal, licencia por vencer y plugin viejo; nada si está revocado", () => {
    const w = serverWarnings(
      server({
        online: false,
        license_state: "expiring",
        plugin_version: "2.4.1",
      }),
      "2.5.0"
    )
    expect(w).toHaveLength(3)
    expect(
      serverWarnings(server({ active: false, online: false }), "2.5.0")
    ).toEqual([])
  })
})
