import type { Page, Route } from "@playwright/test"

import { MEMBERS, TEAM_ID } from "./team-fixtures"

// Torneos simulados: la base local no tiene torneos y armarlos necesita un organizador, equipos
// con SteamID y resultados cargados. Solo se simulan las rutas de torneos, Mi perfil (los equipos)
// y el plantel; la sesión y el resto van contra la API real.

export const E_REG = "e0000000-0000-4000-8000-000000000001"
export const E_LIVE = "e0000000-0000-4000-8000-000000000002"
export const E_DONE = "e0000000-0000-4000-8000-000000000003"
export const E_SWISS = "e0000000-0000-4000-8000-000000000004"
export const E_GD = "e0000000-0000-4000-8000-000000000005"

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
  [E_SWISS]: { stages: 1, size: 16, wins: 3, bo: 1, bo_decisive: 3 },
  [E_GD]: { groups: 2, advance: 2, bo_group: 3 },
}

// Solo en el detalle (no en el listado, para no cambiar sus conteos).
const DETAIL_ONLY = [
  summary(E_SWISS, "Suizo de Primavera", {
    template: "swiss",
    status: "in_progress",
    teams: 16,
    bo: 1,
  }),
  summary(E_GD, "Copa Doble 2026", {
    template: "groups_double",
    status: "in_progress",
    teams: 8,
  }),
]

let n = 0
function match(
  label: string,
  stage: string,
  round: number,
  pos: number,
  a: { id: string; name: string; tag: string } | null,
  b: { id: string; name: string; tag: string } | null,
  extra: {
    status?: string
    s1?: number
    s2?: number
    grp?: number
    bo?: number
  } = {}
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
    best_of: extra.bo ?? (label === "Final" ? 5 : 3),
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

// Todos contra todos de 4: gana el de mejor puesto (el orden de STANDINGS).
const FECHAS = [
  [
    [0, 3],
    [1, 2],
  ],
  [
    [0, 2],
    [3, 1],
  ],
  [
    [0, 1],
    [2, 3],
  ],
]
const roundRobin = (grp: number, teams: (typeof FUR)[]) =>
  FECHAS.flatMap((fecha, r) =>
    fecha.map(([x, y], i) =>
      match(
        `Grupo ${String.fromCharCode(64 + grp)} · fecha ${r + 1}`,
        "group",
        r + 1,
        i + 1,
        teams[x],
        teams[y],
        { grp, bo: 1, s1: x < y ? 1 : 0, s2: x < y ? 0 : 1 }
      )
    )
  )

const DONE_MATCHES = [
  ...roundRobin(1, [FUR, T.krk, T.nmd, T.cnd]),
  ...roundRobin(2, [T.and, T.lpb, T.vrt, T.brv]),
  match("Semifinal", "ko", 1, 1, FUR, T.lpb),
  match("Semifinal", "ko", 1, 2, T.and, T.krk),
  match("Final", "ko", 2, 1, FUR, T.and, { s1: 3, s2: 1 }),
]

// Suizo de 16 a 3 victorias: rondas 1 y 2 jugadas, la 3 a medias (una en vivo). Gana el de
// número más bajo.
export const SWISS_TEAMS = Array.from({ length: 16 }, (_, i) =>
  ref(`t-s${i + 1}`, `Suizo ${i + 1}`, `S${String(i + 1).padStart(2, "0")}`)
)
function swissMatches() {
  const rec = SWISS_TEAMS.map(() => ({ w: 0, l: 0 }))
  const out: ReturnType<typeof match>[] = []
  for (let r = 1; r <= 3; r++) {
    const buckets = new Map<string, number[]>()
    rec.forEach((x, i) => {
      const k = `${x.w}:${x.l}`
      buckets.set(k, [...(buckets.get(k) ?? []), i])
    })
    let pos = 0
    for (const list of buckets.values())
      for (let i = 0; i < list.length / 2; i++) {
        const [a, b] = [list[i], list[list.length - 1 - i]]
        // Ronda 3: las dos primeras jugadas, la tercera en vivo, el resto por jugar.
        const status =
          r < 3 || pos < 2 ? "finished" : pos === 2 ? "live" : "upcoming"
        out.push(
          match(
            `Suizo · fase 1 · ronda ${r}`,
            "swiss",
            r,
            ++pos,
            SWISS_TEAMS[a],
            SWISS_TEAMS[b],
            { bo: 1, s1: 1, s2: 0, status }
          )
        )
        if (status !== "finished") continue
        rec[a].w++
        rec[b].l++
      }
  }
  return out
}
const SWISS_MATCHES = swissMatches()

// Grupos de doble eliminación de 4: el A terminado, el B con la final del upper en vivo.
const GD_MATCHES = [
  match("Grupo A · upper · ronda 1", "group_upper", 1, 1, FUR, T.cnd, {
    grp: 1,
  }),
  match("Grupo A · upper · ronda 1", "group_upper", 1, 2, T.krk, T.nmd, {
    grp: 1,
    s1: 1,
    s2: 2,
  }),
  match("Grupo A · final del upper", "group_upper", 2, 1, FUR, T.nmd, {
    grp: 1,
    s1: 2,
    s2: 1,
  }),
  match("Grupo A · lower · ronda 1", "group_lower", 1, 1, T.cnd, T.krk, {
    grp: 1,
    s1: 0,
    s2: 2,
  }),
  match("Grupo A · final del lower", "group_lower", 2, 1, T.nmd, T.krk, {
    grp: 1,
    s1: 1,
    s2: 2,
  }),
  match("Grupo B · upper · ronda 1", "group_upper", 1, 1, T.and, T.brv, {
    grp: 2,
  }),
  match("Grupo B · upper · ronda 1", "group_upper", 1, 2, T.lpb, T.vrt, {
    grp: 2,
    s1: 2,
    s2: 1,
  }),
  match("Grupo B · final del upper", "group_upper", 2, 1, T.and, T.lpb, {
    grp: 2,
    status: "live",
    s1: 1,
    s2: 1,
  }),
  match("Grupo B · lower · ronda 1", "group_lower", 1, 1, T.brv, T.vrt, {
    grp: 2,
    status: "upcoming",
  }),
  match("Grupo B · final del lower", "group_lower", 2, 1, null, null, {
    grp: 2,
    status: "upcoming",
  }),
]

const gdRow = (
  grp: number,
  place: number,
  team: typeof FUR,
  state: "qualified" | "eliminated" | "active"
) => ({
  stage: "group_double",
  grp,
  phase: 1,
  team,
  place,
  tied: false,
  played: 2,
  won: 1,
  lost: 1,
  points: null,
  rounds_for: null,
  rounds_against: null,
  rounds_diff: 0,
  buchholz: null,
  state,
})
const GD_STANDINGS = [
  gdRow(1, 1, FUR, "qualified"),
  gdRow(1, 2, T.krk, "qualified"),
  gdRow(1, 3, T.nmd, "eliminated"),
  gdRow(1, 4, T.cnd, "eliminated"),
  ...[T.and, T.lpb, T.brv, T.vrt].map((t, i) => gdRow(2, i + 1, t, "active")),
]

/** Detalle de una partida simulada (lo que pide el detalle resumido de la Llave). */
export const MATCH_DETAIL = {
  maps_detail: [{ map: "de_dust2", r1: 13, r2: 7, game_id: null }],
  roster1: [{ player_id: null, alias: "kz", guest: false }],
  roster2: [{ player_id: null, alias: "nox", guest: false }],
  server: { id: null, name: "CMLeague #1", address: null },
}

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
  const ALL_MATCHES = [
    ...LIVE_MATCHES,
    ...DONE_MATCHES,
    ...SWISS_MATCHES,
    ...GD_MATCHES,
  ]
  await pg.route(/\/api\/v1\/matches\/m0000000-[^/?]+$/, (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1)
    const m = ALL_MATCHES.find((x) => x.id === id)
    if (!m) return json(route, { error: { code: "NOT_FOUND" } }, 404)
    return json(route, {
      ...m,
      ...MATCH_DETAIL,
      advantage_side: null,
      demo_url: null,
      demo_size: null,
      link_code: null,
      games: [],
      players: [],
      clutch_data: false,
      mvp: null,
      veto: null,
      review_detail: null,
      live: null,
      viewer: null,
    })
  })
  await pg.route(
    /\/api\/v1\/events\/[^/?]+(\/[^?]*)?(\?.*)?$/,
    async (route) => {
      const req = route.request()
      const [, , , , id, sub, teamId] = new URL(req.url()).pathname.split("/")
      const event = [...events, ...DETAIL_ONLY].find((e) => e.id === id)
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
          page(
            {
              [E_LIVE]: LIVE_MATCHES,
              [E_DONE]: DONE_MATCHES,
              [E_SWISS]: SWISS_MATCHES,
              [E_GD]: GD_MATCHES,
            }[id] ?? []
          )
        )
      if (sub === "standings") {
        const rows: unknown[] =
          id === E_DONE ? STANDINGS : id === E_GD ? GD_STANDINGS : []
        return json(route, page(rows))
      }
      return route.continue()
    }
  )
  return calls
}
