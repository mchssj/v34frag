import {
  format,
  formatDistanceStrict,
  isSameDay,
  parseISO,
  subDays,
} from "date-fns"
import { es } from "date-fns/locale"

import type { Schemas } from "@/api/client"
import type { AppPath } from "../nav"

// Notificaciones de la API (contrato notificaciones.md, sección 12). La base guarda `type` y `data`
// con los nombres del momento; el texto, el icono y el link se arman acá.

export type Notification = Schemas["Notification"]
export type NotificationCategory = Notification["category"]
export type NotificationTab = "all" | "unread" | "requests"

export type NotificationKind =
  | "invite"
  | "roster"
  | "team"
  | "tournament"
  | "veto"
  | "pcw"
  | "elo"
  | "medal"
  | "account"
  | "news"
  | "admin"

export type NotificationLink = { to: AppPath; params?: Record<string, string> }

export type Described = {
  kind: NotificationKind
  title: string
  body: string
  link?: NotificationLink
}

/** Pendiente de aceptar o rechazar desde la lista. */
export const isPending = (n: Notification) =>
  n.actionable && n.resolution === null
/** Se destacan con el color primario: lo que espera una respuesta o un turno. */
export const isUrgent = (n: Notification) =>
  isPending(n) || n.type === "veto_turn"

export function filterByTab(items: Notification[], tab: NotificationTab) {
  if (tab === "unread") return items.filter((n) => !n.read)
  if (tab === "requests") return items.filter((n) => n.actionable)
  return items
}

/** "hace 5 minutos", "hace 3 horas", "ayer", "hace 4 días". */
export function timeAgo(iso: string, now = new Date()) {
  const date = parseISO(iso)
  if (isSameDay(date, subDays(now, 1))) return "ayer"
  return formatDistanceStrict(date, now, { addSuffix: true, locale: es })
}

// ---------- lectura de `data` ----------

type Data = Record<string, unknown>
const obj = (v: unknown): Data =>
  v && typeof v === "object" ? (v as Data) : {}
const str = (v: unknown, fallback = "") =>
  typeof v === "string" && v.trim() ? v : fallback
const num = (v: unknown) => (typeof v === "number" ? v : null)
/** Nombre de un equipo, bando, torneo o temporada: `{ name }` o el texto directo. */
const nameOf = (v: unknown, fallback = "") =>
  typeof v === "string" ? str(v, fallback) : str(obj(v).name, fallback)
const idOf = (v: unknown) => str(obj(v).id)
const signed = (n: number) =>
  n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0"
const day = (iso: unknown) => {
  const v = str(iso)
  return v ? format(parseISO(v), "EEE d 'de' MMM, HH:mm", { locale: es }) : ""
}

const ROLE: Record<string, string> = {
  player: "Activo",
  sub: "Suplente",
  coach: "Coach",
}
const ACCOUNT_ROLE: Record<string, string> = {
  user: "usuario",
  organizer: "organizador",
  admin: "admin",
}
const CATEGORY: Record<NotificationCategory, [NotificationKind, string]> = {
  team: ["team", "Equipos"],
  tournament: ["tournament", "Torneos"],
  pcw: ["pcw", "PCW"],
  elo: ["elo", "Mixes y ELO"],
  season: ["medal", "Temporadas"],
  account: ["account", "Cuenta"],
  news: ["news", "Novedades"],
  admin: ["admin", "Administración"],
}

const matchLink = (id: string): NotificationLink | undefined =>
  id ? { to: "/match/$id", params: { id } } : undefined
const teamLink = (team: unknown): NotificationLink | undefined =>
  idOf(team) ? { to: "/teams/$id", params: { id: idOf(team) } } : undefined
const eventLink = (event: unknown): NotificationLink | undefined =>
  idOf(event) ? { to: "/events/$id", params: { id: idOf(event) } } : undefined

/** Texto, icono y link de una notificación. `me` es el alias propio (link al perfil público). */
export function describe(n: Notification, me?: string | null): Described {
  const d = n.data
  const actor = str(n.actor?.alias)
  const team = nameOf(d.team, "tu equipo")
  const player = str(obj(d.player).alias, "Un jugador")
  const profile: NotificationLink | undefined = me
    ? { to: "/player/$nick", params: { nick: me } }
    : { to: "/profile" }

  // Partidas de torneo y PCW: data.match con los dos bandos.
  const m = obj(d.match)
  const matchId = str(m.match_id, str(d.match_id))
  const vs = `${nameOf(m.team1, "Equipo 1")} vs ${nameOf(m.team2, "Equipo 2")}`
  const where = nameOf(m.event) || (m.kind === "pcw" ? "PCW" : "")
  const score = `${nameOf(m.team1, "Equipo 1")} ${num(d.score1) ?? 0}-${num(d.score2) ?? 0} ${nameOf(m.team2, "Equipo 2")}`
  const scoreNote = d.walkover
    ? "Ganó por W.O."
    : d.corrected
      ? "Resultado corregido."
      : where || "Partida terminada."
  const map = str(d.map, "un mapa")
  const season = nameOf(d.season, "la temporada")

  switch (n.type) {
    // ---------- equipos ----------
    case "team_invite":
      return {
        kind: "invite",
        title: `Invitación a ${team}`,
        body: actor
          ? `${actor} te invitó a unirte al plantel.`
          : "Te invitaron a unirte al plantel.",
      }
    case "team_join_request":
      return {
        kind: "roster",
        title: `${player} quiere entrar a ${team}`,
        body: "Pedido para unirse al plantel.",
        link: teamLink(d.team),
      }
    case "team_invite_answered":
      return {
        kind: "roster",
        title: `${player} ${d.accepted ? "aceptó" : "rechazó"} tu invitación`,
        body: team,
        link: teamLink(d.team),
      }
    case "team_join_answered":
      return {
        kind: "team",
        title: `${team} ${d.accepted ? "aceptó" : "rechazó"} tu pedido`,
        body: d.accepted
          ? "Ya eres parte del plantel."
          : "Puedes pedir entrar a otro equipo.",
        link: teamLink(d.team),
      }
    case "team_captain":
      return {
        kind: "team",
        title: `Ahora eres el líder de ${team}`,
        body: "Puedes invitar jugadores y vetar mapas.",
        link: teamLink(d.team),
      }
    case "team_removed":
      return {
        kind: "team",
        title: `Te sacaron de ${team}`,
        body: "Ya no eres parte del plantel.",
      }
    case "team_member_left":
      return {
        kind: "roster",
        title: `${player} dejó ${team}`,
        body: "Salió del plantel.",
        link: teamLink(d.team),
      }
    case "team_role_changed":
      return {
        kind: "team",
        title: `Ahora eres ${ROLE[str(d.role)] ?? "parte del plantel"} en ${team}`,
        body: "Cambió tu rol en el plantel.",
        link: teamLink(d.team),
      }
    case "team_added":
      return {
        kind: "team",
        title: `Un admin te sumó a ${team}`,
        body: ROLE[str(d.role)] ? `Como ${ROLE[str(d.role)]}.` : "",
        link: teamLink(d.team),
      }
    case "team_deleted":
      return {
        kind: "team",
        title: `Se borró el equipo ${team}`,
        body: "El equipo ya no existe.",
      }
    case "team_request_answered":
      return {
        kind: "team",
        title: `${d.approved ? "Aprobaron" : "Rechazaron"} tu equipo ${str(d.name)}`,
        body: d.approved
          ? "Ya puedes armar el plantel."
          : "Puedes pedirlo de nuevo con otros datos.",
        link: { to: "/myteam" },
      }

    // ---------- torneos ----------
    case "event_registration":
      return {
        kind: "tournament",
        title: d.registered
          ? `${team} quedó inscrito en ${nameOf(d.event)}`
          : `${team} quedó fuera de ${nameOf(d.event)}`,
        body: "Lo hizo el organizador del torneo.",
        link: eventLink(d.event),
      }
    case "event_fixture":
      return {
        kind: "tournament",
        title: `Fixture listo en ${nameOf(d.event, "el torneo")}`,
        body: `Tu primer rival es ${nameOf(d.opponent, "a confirmar")}.`,
        link: matchLink(str(d.match_id)),
      }
    case "match_scheduled":
      return {
        kind: "tournament",
        title: `Nuevo horario: ${vs}`,
        body: day(m.starts_at) || "Sin horario.",
        link: matchLink(matchId),
      }
    case "veto_turn":
      return {
        kind: "veto",
        title: "Te toca vetar",
        body: `${vs} · ${d.action === "pick" ? "elegir" : "banear"} un mapa`,
        link: matchLink(matchId),
      }
    case "veto_done": {
      const maps = (Array.isArray(d.maps) ? d.maps : [])
        .map((x) => str(obj(x).version, str(obj(x).map)))
        .filter(Boolean)
      return {
        kind: "veto",
        title: `Veto terminado: ${vs}`,
        body: maps.length ? maps.join(" · ") : "Ya están los mapas.",
        link: matchLink(matchId),
      }
    }
    case "veto_reset":
      return {
        kind: "veto",
        title: "Se reinició el veto",
        body: `${vs}: el organizador lo empieza de nuevo.`,
        link: matchLink(matchId),
      }
    case "match_result":
      return {
        kind: "tournament",
        title: `Resultado: ${score}`,
        body: scoreNote,
        link: matchLink(matchId),
      }
    case "event_progress":
      return {
        kind: "tournament",
        title:
          d.result === "champion"
            ? `¡${team} es campeón de ${nameOf(d.event)}!`
            : `${team} es subcampeón de ${nameOf(d.event)}`,
        body: "Felicitaciones al plantel.",
        link: eventLink(d.event),
      }
    case "event_cancelled":
      return {
        kind: "tournament",
        title: `Se canceló ${nameOf(d.event, "el torneo")}`,
        body: "El torneo no se juega.",
      }

    // ---------- PCW ----------
    case "pcw_accepted":
      return {
        kind: "pcw",
        title: `${nameOf(d.rival, "Un rival")} aceptó tu PCW`,
        body: `${vs}. Hagan el veto en la sala.`,
        link: matchLink(matchId),
      }
    case "pcw_cancelled":
      return {
        kind: "pcw",
        title: "Se canceló la PCW",
        body: vs,
      }
    case "pcw_result":
      return {
        kind: "pcw",
        title: `Resultado de la PCW: ${score}`,
        body: d.corrected ? "Resultado corregido." : "Práctica terminada.",
        link: matchLink(matchId),
      }

    // ---------- mixes y ELO ----------
    case "level_changed": {
      const to = num(d.to) ?? 0
      const up = to > (num(d.from) ?? 0)
      return {
        kind: "elo",
        title: `${up ? "Subiste" : "Bajaste"} a nivel ${to}`,
        body: num(d.elo) !== null ? `${num(d.elo)} ELO` : "",
        link: profile,
      }
    }
    case "mix_review_resolved":
      return {
        kind: "elo",
        title: `${d.applied ? "Se aplicó" : "Se descartó"} el ELO del mix en ${map}`,
        body: "Era un mix interrumpido y lo revisó un admin.",
        link: matchLink(str(d.match_id)),
      }
    case "mix_deleted":
      return {
        kind: "elo",
        title: `Se borró el mix en ${map}`,
        body:
          d.elo_mode === "keep"
            ? "Tu ELO se mantuvo."
            : d.elo_mode === "revert"
              ? "Se revirtió el ELO que te dio."
              : "No movía ELO.",
      }
    case "elo_adjusted": {
      const set = num(d.set_elo)
      return {
        kind: "elo",
        title: d.removed
          ? "Se deshizo un ajuste de tu ELO"
          : set !== null
            ? `Un admin fijó tu ELO en ${set}`
            : `Un admin te ajustó el ELO: ${signed(num(d.delta) ?? 0)}`,
        body: str(d.reason),
        link: profile,
      }
    }
    case "clip_ready":
      return {
        kind: "elo",
        title: `Tu jugada de la ronda ${num(d.round) ?? "—"} ya tiene video`,
        body: num(d.clutch_vs)
          ? `Clutch 1v${num(d.clutch_vs)}`
          : `${num(d.kills) ?? 0} kills`,
        link: matchLink(str(d.match_id)),
      }

    // ---------- temporadas ----------
    case "season_ranked":
      return {
        kind: "medal",
        title: `Ya tienes puesto en ${season}`,
        body: `Llegaste a ${num(d.min_matches) ?? "los"} mixes en la temporada.`,
        link: { to: "/ranking" },
      }
    case "season_closed": {
      const medal = obj(d.medal)
      const after = num(d.elo_after)
      const parts = [
        str(medal.name) && `${str(medal.icon)} ${str(medal.name)}`.trim(),
        after !== null &&
          after !== num(d.elo) &&
          `empiezas la próxima con ${after}`,
      ].filter(Boolean)
      return {
        kind: "medal",
        title:
          d.eligible && num(d.rank)
            ? `Cerró ${season}: terminaste ${num(d.rank)}.º`
            : `Cerró ${season}`,
        body: parts.length
          ? parts.join(" · ")
          : d.eligible
            ? "Gracias por jugar."
            : "No llegaste al mínimo de mixes para tener puesto.",
        link: profile,
      }
    }
    case "medal_granted":
      return {
        kind: "medal",
        title: `Nueva medalla: ${`${str(d.icon)} ${str(d.title)}`.trim()}`,
        body: "Ya está en tu perfil.",
        link: profile,
      }

    // ---------- cuenta ----------
    case "steam_claimed":
      return {
        kind: "account",
        title: "Tu SteamID quedó vinculado",
        body: "Lo vinculaste con !claim desde el servidor.",
        link: { to: "/profile/link" },
      }
    case "steam_request_answered":
      return {
        kind: "account",
        title: `${d.approved ? "Aprobaron" : "Rechazaron"} tu pedido`,
        body: [
          `${d.kind === "remove" ? "Desvincular" : "Vincular"} un SteamID.`,
          str(d.reason),
        ]
          .filter(Boolean)
          .join(" "),
        link: { to: "/profile/link" },
      }
    case "alias_changed":
      return {
        kind: "account",
        title: `Tu alias ahora es ${str(d.alias)}`,
        body: "Lo cambió un admin.",
        link: { to: "/profile" },
      }
    case "role_changed":
      return {
        kind: "account",
        title: `Ahora eres ${ACCOUNT_ROLE[str(d.role)] ?? "usuario"}`,
        body: "Cambió tu rol en la web.",
      }
    case "password_changed":
      return {
        kind: "account",
        title: "Se cambió tu contraseña",
        body: "Si no fuiste tú, avísale a un admin.",
        link: { to: "/profile/account" },
      }

    // ---------- novedades ----------
    case "event_new":
      return {
        kind: "news",
        title: `Nuevo torneo: ${nameOf(d.event)}`,
        body: str(d.starts_on)
          ? `Empieza el ${format(parseISO(str(d.starts_on)), "d 'de' MMMM", { locale: es })}.`
          : "Ya puedes inscribir a tu equipo.",
        link: eventLink(d.event),
      }
    case "season_started":
      return {
        kind: "news",
        title: `Empezó la temporada ${season}`,
        body: day(d.ends_at) ? `Termina el ${day(d.ends_at)}.` : "",
        link: { to: "/ranking" },
      }

    // ---------- administración ----------
    case "admin_steam_request":
      return {
        kind: "admin",
        title: `Pedido para ${d.kind === "remove" ? "desvincular" : "vincular"} un SteamID`,
        body: player,
        link: { to: "/admin/players" },
      }
    case "admin_team_request":
      return {
        kind: "admin",
        title: `${str(obj(d.user).alias, "Un jugador")} pidió crear ${str(d.name)}`,
        body: str(d.tag) ? `Sigla ${str(d.tag)}` : "Equipo nuevo.",
        link: { to: "/admin/teams" },
      }
    case "admin_mix_review":
      return {
        kind: "admin",
        title: `Mix interrumpido en ${map}`,
        body: "Falta decidir el ELO.",
        link: matchLink(str(d.match_id)),
      }
    case "admin_demo_failed":
      return {
        kind: "admin",
        title: `No se subió la demo del mix en ${map}`,
        body: "Se puede reintentar desde Administración.",
        link: matchLink(str(d.match_id)),
      }
    case "admin_season_delayed":
      return {
        kind: "admin",
        title: "El cierre de la temporada espera",
        body: "Hay un mix en vivo: cierra cuando termine.",
      }
  }

  // Un tipo nuevo que esta versión de la web todavía no conoce.
  const [kind, label] = CATEGORY[n.category] ?? ["news", "Novedades"]
  return { kind, title: `Novedad en ${label}`, body: "" }
}
