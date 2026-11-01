import type { Page, Route } from "@playwright/test"

import { MEMBERS, TEAM_ID } from "./team-fixtures"

// Torneos simulados: la base local no tiene torneos y armarlos necesita un organizador, equipos
// con SteamID y resultados cargados. Solo se simulan las rutas de torneos, Mi perfil (los equipos)
// y el plantel; la sesión y el resto van contra la API real.

export const E_REG = "e0000000-0000-4000-8000-000000000001"
export const E_LIVE = "e0000000-0000-4000-8000-000000000002"
export const E_DONE = "e0000000-0000-4000-8000-000000000003"

const ref = (id: string, name: string, tag: string) => ({ id, name, tag })
const FUR = ref(TEAM_ID, "Furia Sur", "FUR")
const T = {
  and: ref("t-and", "Andes Gaming", "AND"),
  lpb: ref("t-lpb", "Los Pibes", "LPB"),
  krk: ref("t-krk", "Kraken eSports", "KRK"),
  vrt: ref("t-vrt", "Vértigo", "VRT"),
  nmd: ref("t-nmd", "Nómades", "NMD"),
  brv: ref("t-brv", "Brava", "BRV"),
  cnd: ref("t-cnd", "Cóndor Five", "CND"),
}

const summary = (id: string, name: string, extra: Record<string, unknown>) => ({
  id,
  name,
  template: "single",
  status: "registration",
  starts_on: "2026-11-01",
  ends_on: "2026-11-30",
  prize: "USD 500",
  teams: 0,
  max_teams: 8,
  champion: null,
  organizer: { user_id: "u-org", alias: "Organizador" },
  game_mode: "5v5",
  players_per_team: 5,
  subs_max: 0,
  bo: 3,
  bo_final: 3,
  current_stage: null,
  progress: null,
  banner_url: null,
  registration_closes_at: null,
  ...extra,
})

const EVENTS = [
  summary(E_DONE, "Copa Invierno 2025", {
    template: "groups",
    status: "finished",
    starts_on: "2025-07-05",
    ends_on: "2025-08-02",
    prize: "USD 250",
    teams: 8,
    champion: FUR,
    bo: 1,
    progress: { played: 7, total: 7 },
  }),
  summary(E_LIVE, "Copa Otoño 2026", {
    status: "in_progress",
    teams: 8,
    bo_final: 5,
    current_stage: "Semifinal",
    progress: { played: 5, total: 7 },
  }),
  // 2 activos y hasta 1 suplente: con el roster simulado, Tormenta puede ir de suplente.
  summary(E_REG, "Liga Verano 2026", {
    max_teams: 12,
    players_per_team: 2,
    subs_max: 1,
  }),
]

const CONFIG: Record<string, unknown> = {
  [E_REG]: { bo: 3, bo_final: 3 },
  [E_LIVE]: { bo: 3, bo_final: 5 },
  [E_DONE]: { groups: 2, advance: 2, bo_group: 1, playoffs: { bo_final: 3 } },
}

let n = 0
function match(
  label: string,
  stage: string,
  round: number,
  pos: number,
  a: { id: string; name: string; tag: string } | null,
  b: { id: string; name: string; tag: string } | null,
  extra: { status?: string; s1?: number; s2?: number; grp?: number } = {}
) {
  const status = extra.status ?? "finished"
  const done = status === "finished"
  return {
    id: `m0000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    kind: "official",
    status,
    label,
    event: null,
    side1: {
      name: null,
      team: a,
      score: done || status === "live" ? (extra.s1 ?? 2) : null,
    },
    side2: {
      name: null,
      team: b,
      score: done || status === "live" ? (extra.s2 ?? 0) : null,
    },
    winner_side: done ? ((extra.s1 ?? 2) > (extra.s2 ?? 0) ? 1 : 2) : null,
    best_of: label === "Final" ? 5 : 3,
    map: null,
    starts_at: "2026-11-05T22:00:00Z",
    played_at: null,
    end_reason: null,
    cancel_reason: null,
    review: null,
    demo_status: "none",
    parent_match_id: null,
    stage,
    phase: 1,
    grp: extra.grp ?? null,
    round,
    pos,
    bye: false,
  }
}

export const LIVE_MATCHES = [
  match("Cuartos de final", "ko", 1, 1, FUR, T.cnd),
  match("Cuartos de final", "ko", 1, 2, T.krk, T.vrt, { s1: 1, s2: 2 }),
  match("Cuartos de final", "ko", 1, 3, T.and, T.brv),
  match("Cuartos de final", "ko", 1, 4, T.lpb, T.nmd),
  match("Semifinal", "ko", 2, 1, FUR, T.vrt, { status: "live", s1: 1, s2: 0 }),
  match("Semifinal", "ko", 2, 2, T.and, T.lpb, { status: "upcoming" }),
  match("Final", "ko", 3, 1, null, null, { status: "upcoming" }),
]

const DONE_MATCHES = [
  match("Grupo A · fecha 1", "group", 1, 1, FUR, T.cnd, { grp: 1, s1: 1 }),
  match("Semifinal", "ko", 1, 1, FUR, T.lpb),
  match("Semifinal", "ko", 1, 2, T.and, T.krk),
  match("Final", "ko", 2, 1, FUR, T.and, { s1: 3, s2: 1 }),
]

const row = (
  grp: number,
  place: number,
  team: { id: string; name: string; tag: string },
  won: number
) => ({
  stage: "group",
  grp,
  phase: 1,
  team,
  place,
  tied: false,
  played: 3,
  won,
  lost: 3 - won,
  points: won * 3,
  rounds_for: 30 + won * 5,
  rounds_against: 40 - won * 5,
  rounds_diff: won * 10 - 10,
  buchholz: null,
  state: null,
})

const STANDINGS = [
  row(1, 1, FUR, 3),
  row(1, 2, T.krk, 2),
  row(1, 3, T.nmd, 1),
  row(1, 4, T.cnd, 0),
  row(2, 1, T.and, 3),
  row(2, 2, T.lpb, 2),
  row(2, 3, T.vrt, 1),
  row(2, 4, T.brv, 0),
]

const page = <T>(items: T[]) => ({
  items,
  total: items.length,
  page: 1,
  per: 100,
  sort: "x",
  order: "asc",
})

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, json: body })

/**
 * Simula los torneos. `leader`: el usuario lidera Furia Sur; si no, juega en él sin liderazgo.
 * `closed`: las inscripciones de "Liga Verano 2026" ya cerraron.
 * Las inscripciones de "Liga Verano 2026" cambian con cada PUT y DELETE. Devuelve las llamadas de
 * escritura, para comprobarlas.
 */
export async function mockEvents(
  pg: Page,
  { leader = true, closed = false } = {}
) {
  const calls: { method: string; path: string; body: unknown }[] = []
  type Lineup = { team: typeof FUR; active: string[]; subs: string[] }
  const registered = new Map<string, Lineup>([
    [T.lpb.id, { team: T.lpb, active: [], subs: [] }],
    [T.krk.id, { team: T.krk, active: [], subs: [] }],
    [T.vrt.id, { team: T.vrt, active: [], subs: [] }],
  ])
  const events = EVENTS.map((e) =>
    e.id === E_REG && closed
      ? { ...e, registration_closes_at: "2026-01-01T12:00:00Z" }
      : e
  )
  const regCount = () => registered.size

  await pg.route("**/api/v1/me/teams", (route) =>
    json(route, [
      { ...FUR, logo_url: null, my_role: leader ? "leader" : "player" },
    ])
  )
  await pg.route(`**/api/v1/teams/${TEAM_ID}/members**`, (route) =>
    json(route, page(MEMBERS))
  )
  await pg.route(/\/api\/v1\/events(\?.*)?$/, (route) =>
    json(
      route,
      page(
        events.map((e) => (e.id === E_REG ? { ...e, teams: regCount() } : e))
      )
    )
  )
  await pg.route(
    /\/api\/v1\/events\/[^/?]+(\/[^?]*)?(\?.*)?$/,
    async (route) => {
      const req = route.request()
      const [, , , , id, sub, teamId] = new URL(req.url()).pathname.split("/")
      const event = events.find((e) => e.id === id)
      if (!event) return json(route, { error: { code: "NOT_FOUND" } }, 404)

      if (req.method() !== "GET") {
        const body = req.postDataJSON?.() ?? null
        calls.push({
          method: req.method(),
          path: new URL(req.url()).pathname,
          body,
        })
        if (req.method() === "PUT")
          registered.set(teamId, {
            team: FUR,
            active: body.active,
            subs: body.subs,
          })
        if (req.method() === "DELETE") registered.delete(teamId)
        return route.fulfill({ status: 204 })
      }
      if (!sub)
        return json(route, {
          ...event,
          teams: id === E_REG ? regCount() : event.teams,
          rules: null,
          min_teams: null,
          config: CONFIG[id],
          live_match:
            id === E_LIVE
              ? {
                  id: LIVE_MATCHES[4].id,
                  label: "Semifinal",
                  map: "de_dust2",
                  map_index: 2,
                  maps_total: 3,
                }
              : null,
          map_pool: null,
          tie_pending: null,
          draw: null,
          viewer: { can_manage: false },
        })
      if (sub === "registrations")
        return json(
          route,
          page(
            [...registered.values()].map((r, i) => ({
              team: r.team,
              seed: i + 1,
              start_stage: 1,
              players: [
                ...r.active.map((p) => ({
                  player_id: p,
                  alias: p,
                  role: "active",
                })),
                ...r.subs.map((p) => ({ player_id: p, alias: p, role: "sub" })),
              ],
            }))
          )
        )
      if (sub === "matches")
        return json(
          route,
          page(id === E_LIVE ? LIVE_MATCHES : id === E_DONE ? DONE_MATCHES : [])
        )
      if (sub === "standings")
        return json(route, page(id === E_DONE ? STANDINGS : []))
      return route.continue()
    }
  )
  return calls
}
