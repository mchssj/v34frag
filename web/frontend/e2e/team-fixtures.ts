import type { Page, Route } from "@playwright/test"

// Datos simulados de equipos para las pruebas de Mi equipo: armar un capitán real necesita que un
// admin apruebe el equipo y un SteamID vinculado. Solo se simulan las rutas de equipos; la sesión,
// el perfil base y el resto van contra la API real.

export const TEAM_ID = "11111111-1111-4111-8111-111111111111"
export const OTHER_ID = "22222222-2222-4222-8222-222222222222"

const ref = (id: string, name: string, tag: string) => ({ id, name, tag })

const member = (
  id: string,
  alias: string,
  role: "player" | "sub" | "coach",
  extra: Record<string, unknown> = {}
) => ({
  player_id: id,
  alias,
  photo_url: null,
  has_steam: true,
  elo: 1500,
  level: 7,
  role,
  game_role: null,
  is_captain: false,
  joined_at: "2025-01-10T12:00:00Z",
  left_at: null,
  ...extra,
})

export const MEMBERS = [
  member("p-yo", "Zeta", "player", { is_captain: true, game_role: "IGL" }),
  member("p-kova", "kova", "player", { game_role: "AWPer" }),
  member("p-torm", "Tormenta", "player", { game_role: "Entry fragger" }),
  member("p-nacho", "nacho", "sub", { has_steam: false, game_role: "Rifler" }),
  member("p-coach", "Profe", "coach"),
]

// Historial de torneos del equipo (GET /teams/{id}/events).
const HISTORY = [
  {
    event: {
      id: "e-1",
      name: "Copa Invierno 2025",
      template: "groups",
      status: "finished",
      starts_on: "2025-07-05",
      ends_on: "2025-08-02",
    },
    result: "champion",
    place: 1,
    played: 6,
    won: 5,
    lost: 1,
  },
  {
    event: {
      id: "e-2",
      name: "Liga Apertura 2026",
      template: "single",
      status: "in_progress",
      starts_on: "2026-10-01",
      ends_on: null,
    },
    result: "in_progress",
    place: null,
    played: 2,
    won: 2,
    lost: 0,
  },
]

export const detail = (
  id: string,
  name: string,
  tag: string,
  captain = true
) => ({
  id,
  name,
  tag,
  kind: "official",
  captain: { player_id: "p-yo", alias: "Zeta" },
  members: MEMBERS.length,
  max_members: 10,
  plays_as: null,
  logo_url: null,
  looking_for: [],
  founded_at: "2025-01-10T12:00:00Z",
  record: {
    official: { played: 11, won: 9, lost: 2, points: 270 },
    pcw: { played: 0, won: 0, lost: 0, points: 0 },
    events_played: 3,
  },
  viewer: { is_captain: captain, is_member: true, is_admin: false },
})

const page = <T>(items: T[]) => ({
  items,
  total: items.length,
  page: 1,
  per: 100,
  sort: "x",
  order: "desc",
})

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, json: body })

/**
 * Simula Mi perfil con `teams` equipos (el primero como capitán) y las rutas de esos equipos.
 * Devuelve las llamadas de escritura que se hicieron, para comprobarlas.
 */
export async function mockMyTeams(
  pg: Page,
  teams: { id: string; name: string; tag: string }[]
) {
  const calls: { method: string; path: string; body: unknown }[] = []
  await pg.route("**/api/v1/me/profile", async (route) => {
    const res = await route.fetch()
    const profile = await res.json()
    await json(route, {
      ...profile,
      player: {
        id: "p-yo",
        nick: "Zeta",
        photo_url: null,
        steam_id: "76561198000000001",
      },
      teams: teams.map((t, i) => ({
        ...t,
        is_captain: i === 0,
        is_member: true,
      })),
    })
  })
  await pg.route("**/api/v1/me/teams", (route) =>
    json(
      route,
      teams.map((t, i) => ({
        ...t,
        logo_url: null,
        my_role: i === 0 ? "leader" : "player",
      }))
    )
  )
  await pg.route(/\/api\/v1\/teams\/[^/]+(\/.*)?(\?.*)?$/, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const [, , , , id, sub] = url.pathname.split("/")
    const t = teams.find((x) => x.id === id) ?? teams[0]
    if (req.method() !== "GET") {
      calls.push({
        method: req.method(),
        path: url.pathname,
        body: req.postDataJSON?.() ?? null,
      })
      return route.fulfill({ status: 204 })
    }
    if (!sub)
      return json(route, detail(t.id, t.name, t.tag, t.id === teams[0].id))
    if (sub === "members") return json(route, page(MEMBERS))
    if (sub === "events") return json(route, page(HISTORY))
    if (sub === "pending")
      return json(
        route,
        page([
          {
            id: "req-1",
            kind: "request",
            status: "pending",
            team: ref(t.id, t.name, t.tag),
            player: {
              id: "p-chispa",
              alias: "Chispa",
              photo_url: null,
              elo: 1320,
              level: 4,
            },
            role: "player",
            message: "Juego de support, puedo martes y jueves.",
            invited_by: null,
            created_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
            expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
          },
        ])
      )
    return route.continue()
  })
  await pg.route("**/api/v1/join-requests/**", async (route) => {
    const url = new URL(route.request().url())
    calls.push({
      method: route.request().method(),
      path: url.pathname,
      body: null,
    })
    await route.fulfill({ status: 204 })
  })
  await pg.route("**/api/v1/ranking/teams**", (route) =>
    json(route, {
      ...page([
        {
          position: 1,
          team: ref(teams[0].id, teams[0].name, teams[0].tag),
          played: 11,
          won: 9,
          lost: 2,
          points: 270,
        },
      ]),
      pcw: false,
      points_per_win: { official: 30, pcw: 5 },
    })
  )
  await pg.route("**/api/v1/events?**", (route) =>
    json(
      route,
      page([
        {
          id: "e-1",
          name: "Copa Invierno 2025",
          template: "single",
          status: "finished",
          starts_on: "2025-07-05",
          ends_on: "2025-08-02",
          prize: "USD 250",
          teams: 8,
          max_teams: 8,
          champion: ref(teams[0].id, teams[0].name, teams[0].tag),
          organizer: null,
        },
      ])
    )
  )
  await pg.route("**/api/v1/matches?**", (route) =>
    json(
      route,
      page([
        {
          id: "m-1",
          kind: "official",
          status: "finished",
          label: "Cuartos de final",
          event: { id: "e-2", name: "Liga Apertura 2026" },
          side1: {
            name: null,
            team: ref(teams[0].id, teams[0].name, teams[0].tag),
            score: 2,
            stage: null,
            phase: null,
            round: null,
            advantage_side: null,
          },
          side2: {
            name: null,
            team: ref(OTHER_ID, "Brava", "BRV"),
            score: 0,
            stage: null,
            phase: null,
            round: null,
            advantage_side: null,
          },
          winner_side: 1,
          best_of: 3,
          map: null,
          starts_at: null,
          played_at: "2026-10-20T22:00:00Z",
          end_reason: null,
          cancel_reason: null,
          review: null,
          demo_status: "none",
          parent_match_id: null,
        },
      ])
    )
  )
  return calls
}
