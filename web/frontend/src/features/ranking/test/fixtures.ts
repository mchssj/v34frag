import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, vi } from "vitest"

// Datos y servidor de MSW compartidos por las pruebas del ranking.
export const API = "http://api.test"
export const server = setupServer()

/** Levanta el servidor de MSW para el archivo de pruebas que lo llama. */
export function setupApi() {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
  afterEach(() => {
    server.resetHandlers()
    vi.clearAllMocks()
  })
  afterAll(() => server.close())
}

export const page = <T>(items: T[]) => ({
  items,
  total: items.length,
  page: 1,
  per: 25,
  sort: "x",
  order: "asc",
})

export const beta = {
  id: "s1",
  number: 1,
  name: "BETA",
  status: "active",
  starts_at: "2026-10-13T00:00:00Z",
  ends_at: "2099-11-23T09:00:00Z",
  closed_at: null,
  top_n: 20,
  min_matches: 20,
  reset_pct: 10,
  reset_floor: 2001,
  tiers: [],
  champion: null,
  medals: 0,
}

export const standing = (alias: string, o: Record<string, unknown> = {}) => ({
  rank: 1,
  player: { id: alias, alias, photo_url: null },
  eligible: true,
  elo: 1100,
  level: 5,
  peak_elo: 1120,
  matches: 22,
  wins: 12,
  losses: 10,
  elo_after: 1100,
  medal: { name: "Campeón", design: null },
  teams: [],
  rating: 1.21,
  kd: 1.15,
  ...o,
})

export const ranked = (alias: string, o: Record<string, unknown> = {}) => ({
  position: 1,
  player: { id: alias, alias, photo_url: null },
  level: 5,
  elo: 1182,
  teams: [{ id: "t1", name: "GO TO KNOW", tag: "GTK" }],
  rating: 1.67,
  kd: 2.01,
  matches: 13,
  elo_matches: 13,
  country: "Argentina",
  game_role: "AWPer",
  elo_trend: [1000, 1050, 1182],
  ...o,
})

export const profile = {
  user: {},
  details: {},
  player: { id: "me", nick: "Zeta", photo_url: null, steam_id: null },
  teams: [
    {
      id: "t1",
      name: "GO TO KNOW",
      tag: "GTK",
      is_captain: true,
      is_member: true,
    },
    { id: "t2", name: "Brava", tag: "BRV", is_captain: false, is_member: true },
  ],
  matches_played: 0,
  preferences: {},
}

export function common() {
  server.use(
    http.get(`${API}/api/v1/me/profile`, () => HttpResponse.json(profile)),
    http.get(`${API}/api/v1/seasons`, () => HttpResponse.json(page([beta])))
  )
}
