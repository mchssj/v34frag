import { QueryClient } from "@tanstack/react-query"
import { isRedirect } from "@tanstack/react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError, networkError } from "@/api/errors"
import {
  redirectIfSignedIn,
  requireAdminSection,
  requireAuth,
  requireGuest,
} from "./guards"
import type { AuthUser } from "./queries"

const { queryFn, store } = vi.hoisted(() => ({
  queryFn: vi.fn(),
  store: { session: null as object | null },
}))

vi.mock("./queries", () => ({
  meQueryOptions: {
    queryKey: ["auth", "me"],
    queryFn: () => queryFn(),
    retry: false,
  },
}))
vi.mock("./tokenStore", () => ({
  tokenStore: {
    ready: () => Promise.resolve(),
    getState: () => ({ session: store.session }),
  },
}))

const user: AuthUser = {
  id: "u1",
  email: "a@b.c",
  tag: "Mecha",
  role: "user",
  created_at: null,
  password_changed_at: null,
}

let queryClient: QueryClient
beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryFn.mockReset()
  store.session = null
})

const location = { href: "/completar-perfil?paso=redes" }

async function caught(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    return e
  }
  return undefined
}

describe("requireAuth", () => {
  it("con usuario lo devuelve para el contexto de las rutas hijas", async () => {
    queryFn.mockResolvedValue(user)
    await expect(
      requireAuth({ context: { queryClient }, location })
    ).resolves.toEqual({ user })
  })

  it("sin sesión manda al login con la ruta de vuelta", async () => {
    queryFn.mockResolvedValue(null)
    const e = await caught(requireAuth({ context: { queryClient }, location }))
    expect(isRedirect(e)).toBe(true)
    expect((e as { options: object }).options).toMatchObject({
      to: "/login",
      search: { redirect: "/completar-perfil?paso=redes" },
    })
  })

  it("con la API caída NO manda al login: relanza el error", async () => {
    queryFn.mockRejectedValue(networkError())
    const e = await caught(requireAuth({ context: { queryClient }, location }))
    expect(isRedirect(e)).toBe(false)
    expect(e).toMatchObject({ code: "NETWORK" })
  })

  it("con un 500 tampoco manda al login", async () => {
    queryFn.mockRejectedValue(
      new ApiError({ status: 500, code: "INTERNAL", message: "" })
    )
    const e = await caught(requireAuth({ context: { queryClient }, location }))
    expect(isRedirect(e)).toBe(false)
  })
})

describe("requireGuest", () => {
  it("con sesión sale a la ruta de vuelta, si es segura", async () => {
    queryFn.mockResolvedValue(user)
    const e = await caught(
      requireGuest({ context: { queryClient }, search: { redirect: "/panel" } })
    )
    expect((e as { options: object }).options).toMatchObject({ href: "/panel" })
  })

  it("ignora una ruta de vuelta externa", async () => {
    queryFn.mockResolvedValue(user)
    const e = await caught(
      requireGuest({
        context: { queryClient },
        search: { redirect: "//evil.com" },
      })
    )
    expect((e as { options: object }).options).toMatchObject({ href: "/home" })
  })

  it("sin sesión o con la API caída deja ver la página", async () => {
    queryFn.mockResolvedValue(null)
    await expect(
      requireGuest({ context: { queryClient }, search: {} })
    ).resolves.toBeUndefined()
    queryClient.clear()
    queryFn.mockRejectedValue(networkError())
    await expect(
      requireGuest({ context: { queryClient }, search: {} })
    ).resolves.toBeUndefined()
  })
})

describe("requireAdminSection", () => {
  const at = (role: AuthUser["role"], pathname: string) => () =>
    requireAdminSection({
      context: { user: { ...user, role } },
      location: { pathname },
    })
  const target = (fn: () => void) => {
    try {
      fn()
    } catch (e) {
      if (isRedirect(e)) return e.options.to
      throw e
    }
    return "pasa"
  }

  it("el admin entra a todas las secciones", () => {
    expect(target(at("admin", "/admin/players"))).toBe("pasa")
    expect(target(at("admin", "/admin/users"))).toBe("pasa")
  })

  it("el organizador solo entra a Torneos; si pide otra sección, vuelve ahí", () => {
    expect(target(at("organizer", "/admin/events"))).toBe("pasa")
    expect(target(at("organizer", "/admin/servers"))).toBe("/admin/events")
  })

  it("un usuario común vuelve al inicio", () => {
    expect(target(at("user", "/admin/events"))).toBe("/home")
  })

  it("/admin sin sección lleva a Torneos a quien puede entrar", () => {
    expect(target(at("admin", "/admin"))).toBe("/admin/events")
  })
})

describe("redirectIfSignedIn (landing)", () => {
  it("sin sesión guardada no consulta la API ni espera", async () => {
    await expect(
      redirectIfSignedIn({ context: { queryClient } })
    ).resolves.toBeUndefined()
    expect(queryFn).not.toHaveBeenCalled()
  })

  it("con sesión va a /home", async () => {
    store.session = {}
    queryFn.mockResolvedValue(user)
    const e = await caught(redirectIfSignedIn({ context: { queryClient } }))
    expect((e as { options: object }).options).toMatchObject({ to: "/home" })
  })

  it("con la API caída deja ver la landing", async () => {
    store.session = {}
    queryFn.mockRejectedValue(networkError())
    await expect(
      redirectIfSignedIn({ context: { queryClient } })
    ).resolves.toBeUndefined()
  })
})
