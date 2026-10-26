import { subMinutes } from "date-fns"
import { describe as group, expect, it } from "vitest"

import { sampleNotifications } from "./mock"
import {
  describe,
  filterByTab,
  isPending,
  isUrgent,
  timeAgo,
  type Notification,
} from "./model"

const base = (o: Partial<Notification>): Notification => ({
  id: 1,
  type: "team_invite",
  category: "team",
  data: {},
  actionable: false,
  resolution: null,
  actor: null,
  created_at: "2026-10-25T12:00:00Z",
  read: false,
  ...o,
})

// Todos los tipos de la primera etapa (contrato notificaciones.md).
const TYPES: [string, Notification["category"]][] = [
  ["team_invite", "team"],
  ["team_join_request", "team"],
  ["team_invite_answered", "team"],
  ["team_join_answered", "team"],
  ["team_captain", "team"],
  ["team_removed", "team"],
  ["team_member_left", "team"],
  ["team_role_changed", "team"],
  ["team_added", "team"],
  ["team_deleted", "team"],
  ["team_request_answered", "team"],
  ["event_registration", "tournament"],
  ["event_fixture", "tournament"],
  ["match_scheduled", "tournament"],
  ["veto_turn", "tournament"],
  ["veto_done", "tournament"],
  ["veto_reset", "tournament"],
  ["match_result", "tournament"],
  ["event_progress", "tournament"],
  ["event_cancelled", "tournament"],
  ["pcw_accepted", "pcw"],
  ["pcw_cancelled", "pcw"],
  ["pcw_result", "pcw"],
  ["level_changed", "elo"],
  ["mix_review_resolved", "elo"],
  ["mix_deleted", "elo"],
  ["elo_adjusted", "elo"],
  ["clip_ready", "elo"],
  ["season_ranked", "season"],
  ["season_closed", "season"],
  ["medal_granted", "season"],
  ["steam_claimed", "account"],
  ["steam_request_answered", "account"],
  ["alias_changed", "account"],
  ["role_changed", "account"],
  ["password_changed", "account"],
  ["event_new", "news"],
  ["season_started", "news"],
  ["admin_steam_request", "admin"],
  ["admin_team_request", "admin"],
  ["admin_mix_review", "admin"],
  ["admin_demo_failed", "admin"],
  ["admin_season_delayed", "admin"],
]

const match = {
  match_id: "m1",
  kind: "official",
  team1: { id: "t1", name: "Furia Sur" },
  team2: { id: "t2", name: "RBK" },
  event: { id: "e1", name: "Copa CM" },
  starts_at: "2026-10-25T21:00:00Z",
}

group("notificaciones", () => {
  it("cada tipo tiene un texto propio, sin huecos, aun con data vacía", () => {
    for (const [type, category] of TYPES) {
      const d = describe(base({ type, category }))
      expect(d.title, type).not.toMatch(/undefined|null|Novedad en/)
      expect(d.title.trim(), type).not.toBe("")
    }
  })

  it("un tipo que la web no conoce muestra su categoría", () => {
    expect(describe(base({ type: "algo_nuevo", category: "pcw" }))).toEqual({
      kind: "pcw",
      title: "Novedad en PCW",
      body: "",
    })
  })

  it("arma texto y link con los datos del momento", () => {
    expect(
      describe(
        base({
          type: "team_invite",
          data: { invite_id: "i1", team: { id: "t1", name: "Furia Sur" } },
          actor: { id: "u2", alias: "Kova" },
        })
      )
    ).toMatchObject({
      kind: "invite",
      title: "Invitación a Furia Sur",
      body: "Kova te invitó a unirte al plantel.",
    })
    expect(
      describe(
        base({
          type: "veto_turn",
          category: "tournament",
          data: { match, action: "pick" },
        })
      )
    ).toEqual({
      kind: "veto",
      title: "Te toca vetar",
      body: "Furia Sur vs RBK · elegir un mapa",
      link: { to: "/match/$id", params: { id: "m1" } },
    })
    expect(
      describe(
        base({
          type: "match_result",
          category: "tournament",
          data: {
            match,
            score1: 2,
            score2: 1,
            walkover: false,
            corrected: true,
          },
        })
      )
    ).toMatchObject({
      title: "Resultado: Furia Sur 2-1 RBK",
      body: "Resultado corregido.",
    })
    expect(
      describe(
        base({
          type: "season_closed",
          category: "season",
          data: {
            season: { id: "s1", name: "BETA" },
            rank: 4,
            eligible: true,
            elo: 2210,
            elo_after: 2022,
            medal: { name: "Top 10", icon: "🏅" },
          },
        }),
        "Zeta"
      )
    ).toEqual({
      kind: "medal",
      title: "Cerró BETA: terminaste 4.º",
      body: "🏅 Top 10 · empiezas la próxima con 2022",
      link: { to: "/player/$nick", params: { nick: "Zeta" } },
    })
    expect(
      describe(
        base({
          type: "elo_adjusted",
          category: "elo",
          data: { delta: -20, reason: "Mix caído" },
        })
      ).title
    ).toBe("Un admin te ajustó el ELO: −20")
  })

  it("pendientes, urgentes y pestañas", () => {
    const items = sampleNotifications()
    expect(items.filter(isPending).map((n) => n.type)).toEqual(["team_invite"])
    expect(items.filter(isUrgent).map((n) => n.type)).toEqual([
      "team_invite",
      "veto_turn",
    ])
    expect(filterByTab(items, "all")).toHaveLength(items.length)
    expect(filterByTab(items, "unread").every((n) => !n.read)).toBe(true)
    // Solicitudes: las que se responden desde la lista, también las ya resueltas.
    expect(filterByTab(items, "requests").map((n) => n.type)).toEqual([
      "team_invite",
      "team_join_request",
    ])
  })

  it("tiempo relativo", () => {
    const now = new Date(2026, 9, 18, 12, 0)
    const ago = (m: number) => subMinutes(now, m).toISOString()
    expect(timeAgo(ago(5), now)).toBe("hace 5 minutos")
    expect(timeAgo(ago(180), now)).toBe("hace 3 horas")
    expect(timeAgo(ago(60 * 24), now)).toBe("ayer")
    expect(timeAgo(ago(60 * 24 * 4), now)).toBe("hace 4 días")
  })
})
