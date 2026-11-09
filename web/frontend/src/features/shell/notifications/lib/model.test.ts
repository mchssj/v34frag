import { subMinutes } from "date-fns"
import { describe as group, expect, it } from "vitest"

import { sampleNotifications } from "./mock"
import {
  clipsSummary,
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
  ["team_staff_action", "team"],
  ["team_member_left", "team"],
  ["team_role_changed", "team"],
  ["team_added", "team"],
  ["team_deleted", "team"],
  ["team_request_answered", "team"],
  ["friend_request", "friends"],
  ["friend_accepted", "friends"],
  ["profile_comment", "friends"],
  ["profile_like", "friends"],
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
  ["pcw_offer", "pcw"],
  ["pcw_offer_chosen", "pcw"],
  ["pcw_offer_rejected", "pcw"],
  ["pcw_soon", "pcw"],
  ["pcw_expired", "pcw"],
  ["level_changed", "elo"],
  ["mix_review_resolved", "elo"],
  ["mix_deleted", "elo"],
  ["elo_adjusted", "elo"],
  ["clip_ready", "elo"],
  ["clips_detected", "elo"],
  ["season_ranked", "season"],
  ["season_closed", "season"],
  ["medal_granted", "season"],
  ["steam_claimed", "account"],
  ["steam_request_answered", "account"],
  ["alias_changed", "account"],
  ["role_changed", "account"],
  ["password_changed", "account"],
  ["streamer_granted", "account"],
  ["streamer_revoked", "account"],
  ["event_new", "news"],
  ["season_started", "news"],
  ["admin_steam_request", "admin"],
  ["admin_team_request", "admin"],
  ["admin_mix_review", "admin"],
  ["admin_demo_failed", "admin"],
  ["admin_season_delayed", "admin"],
  ["event_reviewed", "tournament"],
  ["game_reviewed", "tournament"],
  ["admin_event_review", "admin"],
  ["admin_game_review", "admin"],
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
            medal: {
              name: "Top 10",
              design: {
                template: "top_temporada",
                title: "Top 10 de la temporada",
                label: "S1",
                band: "TOP 10",
                metal: "plata",
                accent: "top10",
              },
            },
          },
        }),
        "Zeta"
      )
    ).toEqual({
      kind: "medal",
      title: "Cerró BETA: terminaste 4.º",
      body: "Top 10 · empiezas la próxima con 2022",
      link: { to: "/player/$nick", params: { nick: "Zeta" } },
      // (replanteo 79) La medalla dibujada, sin emoji.
      medal: {
        template: "top_temporada",
        title: "Top 10 de la temporada",
        number: null,
        label: "S1",
        band: "TOP 10",
        metal: "plata",
        accent: "top10",
      },
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

group("team_staff_action", () => {
  it("dice quién, qué y el motivo", () => {
    const d = describe(
      base({
        type: "team_staff_action",
        category: "team",
        data: {
          team: { id: "t1", name: "Kraken" },
          action: "renamed",
          by: "moderator",
          name: "Halcones",
          reason: "Palabra no permitida",
        },
      })
    )
    expect(d.title).toBe("Un moderador cambió el nombre del equipo a Halcones")
    expect(d.body).toBe("Motivo: Palabra no permitida")
    const k = describe(
      base({
        type: "team_staff_action",
        category: "team",
        data: {
          team: { id: "t1", name: "Kraken" },
          action: "member_removed",
          by: "admin",
          player: { id: "p", alias: "vex" },
          reason: null,
        },
      })
    )
    expect(k.title).toBe("Un admin sacó a vex de Kraken")
    expect(k.body).toBe("Sin motivo indicado.")
  })

  it("aprobación de torneos y mixes (replanteo 80)", () => {
    const ev = { id: "e1", name: "Copa CM" }
    const rejected = describe(
      base({
        type: "event_reviewed",
        category: "tournament",
        data: { event: ev, approved: false, note: "Faltan las fechas." },
      })
    )
    expect(rejected.title).toBe("Rechazaron tu torneo Copa CM")
    expect(rejected.body).toBe(
      "Faltan las fechas. Corrígelo y vuelve a enviarlo."
    )
    expect(rejected.link).toEqual({
      to: "/admin/events/$id",
      params: { id: "e1" },
    })
    const game = describe(
      base({
        type: "game_reviewed",
        category: "tournament",
        data: { ...match, approved: true, map: "de_dust2" },
      })
    )
    expect(game.title).toBe("Aprobaron el mix de de_dust2 en Furia Sur vs RBK")
    const staff = describe(
      base({
        type: "admin_event_review",
        category: "admin",
        data: { event: ev, historic: true, resubmitted: true },
        actor: { id: "u2", alias: "Kova" },
      })
    )
    expect(staff.title).toBe("Volvieron a enviar el torneo histórico Copa CM")
    expect(staff.body).toBe("Kova espera que lo apruebes o lo rechaces.")
    expect(
      describe(
        base({
          type: "admin_game_review",
          category: "admin",
          data: { ...match, games: 2 },
        })
      ).title
    ).toBe("2 mixes vinculados por aprobar")
  })
})

group("clips_detected (replanteo 83)", () => {
  it("un solo aviso con todas las jugadas, que lleva a las estadísticas", () => {
    expect(
      describe(
        base({
          type: "clips_detected",
          category: "elo",
          data: {
            match_id: "g1",
            map: "de_mirage_rc1",
            count: 3,
            kills: [4, 4],
            clutches: [2],
          },
        })
      )
    ).toEqual({
      kind: "elo",
      title: "Tienes 3 jugadas destacadas en de_mirage_rc1",
      body: "2 rondas de 4 kills y un clutch 1v2.",
      link: {
        to: "/match/$id",
        params: { id: "g1" },
        search: { view: "stats" },
      },
    })
  })

  it("una sola jugada, sin mapa", () => {
    const d = describe(
      base({
        type: "clips_detected",
        category: "elo",
        data: { match_id: "g1", count: 1, kills: [5], clutches: [] },
      })
    )
    expect(d.title).toBe("Tienes una jugada destacada")
    expect(d.body).toBe("Un ace.")
  })

  it("el resumen junta por tipo", () => {
    expect(clipsSummary([3, 5, 3, 4], [3, 1, 3])).toBe(
      "Un ace, una ronda de 4 kills, 2 rondas de 3 kills, 2 clutches 1v3 y un clutch 1v1."
    )
    expect(clipsSummary([], [])).toBe(
      "Mira cómo te fue en las estadísticas de la partida."
    )
  })
})

group("amigos (replanteo 85)", () => {
  it("la solicitud y el aviso de aceptada, con el link al perfil", () => {
    const player = { id: "p1", alias: "romanxz" }
    const req = describe(
      base({ type: "friend_request", category: "friends", data: { player } })
    )
    expect(req.title).toBe("romanxz te envió una solicitud de amistad")
    expect(req.link).toEqual({
      to: "/player/$nick",
      params: { nick: "romanxz" },
    })
    expect(
      describe(
        base({ type: "friend_accepted", category: "friends", data: { player } })
      ).title
    ).toBe("romanxz aceptó tu solicitud")
  })
})

group("tu perfil (replanteo 91)", () => {
  it("el comentario lleva a la pestaña Comentarios propia y el me gusta al que lo dio", () => {
    const player = { id: "p1", alias: "romanxz" }
    const profile = { id: "p2", alias: "kyan" }
    const c = describe(
      base({
        type: "profile_comment",
        category: "friends",
        data: { player, profile, comment: "gran clutch" },
      })
    )
    expect(c.title).toBe("romanxz comentó en tu perfil")
    expect(c.body).toBe("gran clutch")
    expect(c.link).toEqual({
      to: "/player/$nick",
      params: { nick: "kyan" },
      search: { tab: "comentarios" },
    })
    const l = describe(
      base({
        type: "profile_like",
        category: "friends",
        data: { player, profile },
      })
    )
    expect(l.title).toBe("A romanxz le gusta tu perfil")
    expect(l.link).toEqual({ to: "/player/$nick", params: { nick: "romanxz" } })
  })
})
