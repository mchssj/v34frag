import { subMinutes } from "date-fns"

import type { Notification } from "./model"

// Notificaciones de ejemplo con la forma de la API, para las pruebas.
export function sampleNotifications(now = new Date()): Notification[] {
  const ago = (minutes: number) => subMinutes(now, minutes).toISOString()
  const team = { id: "t1", name: "Furia Sur", tag: "FUR" }
  const match = {
    match_id: "m1",
    kind: "official",
    team1: { id: "t1", name: "Furia Sur" },
    team2: { id: "t2", name: "RBK" },
    event: { id: "e1", name: "Copa CM" },
    starts_at: null,
  }
  return [
    {
      id: 1,
      type: "team_invite",
      category: "team",
      data: { invite_id: "i1", team },
      actionable: true,
      resolution: null,
      actor: { id: "u2", alias: "Kova" },
      created_at: ago(5),
      read: false,
    },
    {
      id: 2,
      type: "veto_turn",
      category: "tournament",
      data: { match, action: "ban", last: null },
      actionable: false,
      resolution: null,
      actor: null,
      created_at: ago(12),
      read: false,
    },
    {
      id: 3,
      type: "team_join_request",
      category: "team",
      data: { invite_id: "j1", team, player: { id: "p9", alias: "Mati" } },
      actionable: true,
      resolution: "accepted",
      actor: { id: "u9", alias: "Mati" },
      created_at: ago(60 * 48),
      read: true,
    },
    {
      id: 4,
      type: "medal_granted",
      category: "season",
      data: { title: "BETA · Top 10", icon: "🏅" },
      actionable: false,
      resolution: null,
      actor: null,
      created_at: ago(60 * 24),
      read: true,
    },
  ]
}
