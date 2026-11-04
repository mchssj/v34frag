import { describe, expect, it, vi } from "vitest"

import { consumeAuthCallback } from "./callback"

function run(url: string) {
  const u = new URL(url, "http://localhost")
  const history = { state: null, replaceState: vi.fn() }
  const target = consumeAuthCallback(
    { pathname: u.pathname, search: u.search, hash: u.hash },
    history
  )
  return { target, history }
}

describe("consumeAuthCallback", () => {
  it("descarta los tokens del link de confirmación y manda al login con aviso", () => {
    const { target, history } = run(
      "/#access_token=x&refresh_token=y&expires_at=1&type=signup"
    )
    expect(target).toBe("/login?aviso=cuenta-confirmada")
    expect(history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/login?aviso=cuenta-confirmada"
    )
  })

  it("con un link vencido avisa que el enlace no es válido", () => {
    const { target } = run(
      "/#error=access_denied&error_code=otp_expired&error_description=Email+link"
    )
    expect(target).toBe("/login?aviso=enlace-invalido")
  })

  it("con flujo PKCE (?code=) en la raíz también limpia la URL", () => {
    expect(run("/?code=abc").target).toBe("/login?aviso=cuenta-confirmada")
  })

  it("un link de recuperación con tokens (plantilla vieja) los descarta y lleva a pedir otro correo", () => {
    const { target, history } = run(
      "/#access_token=x&refresh_token=y&expires_at=1&type=recovery"
    )
    expect(target).toBe("/forgot-password?aviso=enlace-viejo")
    expect(history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/forgot-password?aviso=enlace-viejo"
    )
  })

  it("un link de recuperación vencido también lleva a pedir otro correo", () => {
    expect(
      run("/#error=access_denied&error_code=otp_expired&type=recovery").target
    ).toBe("/forgot-password?aviso=enlace-viejo")
  })

  it("con ?token_hash=…&type=recovery en la raíz pasa el token a /reset-password", () => {
    const { target } = run("/?token_hash=abc123&type=recovery")
    expect(target).toBe("/reset-password?token_hash=abc123&type=recovery")
  })

  it("no toca /reset-password con su token (lo usa la página)", () => {
    expect(
      run("/reset-password?token_hash=abc123&type=recovery").target
    ).toBeNull()
  })

  it("otros tipos de link solo limpian la URL", () => {
    const { target, history } = run("/panel#access_token=x&type=magiclink")
    expect(target).toBe("/panel")
    expect(history.replaceState).toHaveBeenCalledWith(null, "", "/panel")
  })

  it("no toca una URL normal", () => {
    const { target, history } = run("/completar-perfil?paso=datos#arriba")
    expect(target).toBeNull()
    expect(history.replaceState).not.toHaveBeenCalled()
  })
})
