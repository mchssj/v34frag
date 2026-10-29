import { describe, expect, it } from "vitest"

import { activeNavKey, breadcrumbsFor } from "./nav"

const mix = {
  kind: "mix" as const,
  map: "de_dust2",
  a: "Bando A",
  b: "Bando B",
}
const official = {
  kind: "official" as const,
  map: "de_inferno",
  a: "FUR",
  b: "AND",
}

describe("activeNavKey", () => {
  it("marca el ítem de la ruta, también en sus subrutas", () => {
    expect(activeNavKey("/home")).toBe("home")
    expect(activeNavKey("/matches/results")).toBe("matches")
    expect(activeNavKey("/events/abc")).toBe("events")
    expect(activeNavKey("/hall-of-fame")).toBe("hall-of-fame")
    expect(activeNavKey("/profile")).toBe("profile")
  })

  it("las fichas de jugador y equipo marcan Ranking", () => {
    expect(activeNavKey("/player/Zeta")).toBe("ranking")
    expect(activeNavKey("/players/compare")).toBe("ranking")
    expect(activeNavKey("/teams/abc")).toBe("ranking")
    expect(activeNavKey("/ranking/teams")).toBe("ranking")
  })

  it("una partida marca Mixes o Partidas según su tipo, y nada mientras carga", () => {
    expect(activeNavKey("/match/1", { match: mix })).toBe("mixes")
    expect(activeNavKey("/match/1", { match: official })).toBe("matches")
    expect(activeNavKey("/match/1")).toBeNull()
  })

  it("la sala de un mix en vivo marca Mixes", () => {
    expect(activeNavKey("/mixes/live/abc")).toBe("mixes")
  })

  it("Administración por sección", () => {
    expect(activeNavKey("/admin/players")).toBe("admin-players")
    expect(activeNavKey("/admin")).toBeNull()
  })
})

describe("breadcrumbsFor", () => {
  const labels = (path: string, data = {}) =>
    breadcrumbsFor(path, data).map((c) => c.label)

  it("Administración y sus secciones", () => {
    expect(labels("/admin/events")).toEqual([
      "Administración",
      "Torneos y resultados",
    ])
    expect(labels("/admin/users")).toEqual(["Administración", "Usuarios"])
    expect(labels("/admin/bans")).toEqual(["Administración", "Baneos"])
    expect(labels("/admin/maps")).toEqual(["Administración", "Mapas"])
    expect(labels("/admin/seasons")).toEqual(["Administración", "Temporadas"])
    expect(labels("/admin/clips")).toEqual(["Administración", "Clips"])
    expect(labels("/admin/ranking")).toEqual([
      "Administración",
      "Ranking de equipos",
    ])
  })

  it("fichas con su nombre, o un genérico mientras carga", () => {
    expect(labels("/player/Zeta%20Pro")).toEqual(["Ranking", "Zeta Pro"])
    expect(labels("/teams/1", { team: "Furia Sur" })).toEqual([
      "Ranking",
      "Furia Sur",
    ])
    expect(labels("/teams/1")).toEqual(["Ranking", "Equipo"])
    expect(labels("/events/1", { event: "Liga Apertura" })).toEqual([
      "Torneos",
      "Liga Apertura",
    ])
  })

  it("partidas: equipos o mix con mapa", () => {
    expect(labels("/match/1", { match: official })).toEqual([
      "Partidas",
      "FUR vs AND",
    ])
    expect(labels("/match/1", { match: mix })).toEqual([
      "Mixes",
      "Mix · de_dust2",
    ])
    expect(labels("/mixes")).toEqual(["Mixes"])
    expect(labels("/mixes/live/abc")).toEqual(["Mixes", "En vivo"])
  })

  it("subpáginas y páginas simples", () => {
    expect(labels("/matches/results")).toEqual(["Partidas", "Resultados"])
    expect(labels("/players/compare")).toEqual(["Ranking", "Comparar"])
    expect(labels("/profile")).toEqual(["Mi perfil"])
    expect(labels("/home")).toEqual(["Para ti"])
  })

  it("los previos llevan link y el último no", () => {
    const crumbs = breadcrumbsFor("/matches/results")
    expect(crumbs[0].to).toBe("/matches")
    expect(crumbs[1].to).toBeUndefined()
  })
})

describe("breadcrumbs de Mi perfil", () => {
  it("la sección principal es Mi perfil; las otras cuelgan de ella", () => {
    expect(breadcrumbsFor("/profile").map((c) => c.label)).toEqual([
      "Mi perfil",
    ])
    const link = breadcrumbsFor("/profile/link")
    expect(link.map((c) => c.label)).toEqual(["Mi perfil", "Vinculación"])
    expect(link[0].to).toBe("/profile")
    expect(activeNavKey("/profile/account")).toBe("profile")
  })
})

describe("Baneos en el sidebar", () => {
  it("es una sección propia, marcada en /admin/bans", () => {
    expect(activeNavKey("/admin/bans")).toBe("admin-bans")
    expect(activeNavKey("/admin/users")).toBe("admin-users")
  })
})
