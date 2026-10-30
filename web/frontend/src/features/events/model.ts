import { differenceInMinutes, format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

import type {
  EventDetail,
  EventMatch,
  EventSummary,
  LiveMatch,
  Standing,
} from "./queries"

export type EventStatus = EventSummary["status"]
export type Template = EventSummary["template"]
export type Config = Record<string, unknown>

export const TEMPLATE_LABEL: Record<Template, string> = {
  single: "Eliminación directa",
  double: "Doble eliminación",
  groups: "Grupos + playoffs",
  swiss: "Suizo + playoffs",
  groups_double: "Grupos de doble eliminación + playoffs",
}

export const STATUS_LABEL: Record<EventStatus, string> = {
  registration: "Inscripciones",
  in_progress: "En curso",
  finished: "Finalizado",
  cancelled: "Cancelado",
}

/** Colores del chip de estado del handoff. */
export const STATUS_CHIP: Record<EventStatus, string> = {
  in_progress: "bg-primary text-primary-foreground",
  registration: "bg-foreground text-background",
  finished: "bg-secondary text-secondary-foreground",
  cancelled: "border bg-background text-muted-foreground",
}

/** Orden del listado: Inscripciones → En curso → Finalizado (y los cancelados al final). */
export const STATUS_ORDER: Record<EventStatus, number> = {
  registration: 0,
  in_progress: 1,
  finished: 2,
  cancelled: 3,
}

export function sortEvents<T extends Pick<EventSummary, "status">>(
  events: T[]
) {
  // Estable: dentro de cada estado queda el orden del backend (el que empieza más tarde primero).
  return events.toSorted(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  )
}

const num = (v: unknown) => (typeof v === "number" ? v : undefined)

/** "BO3 · Final BO5" con el BO que calcula el backend; sin BO todavía, null. */
export function boText(e: Pick<EventSummary, "bo" | "bo_final">) {
  const parts = [
    e.bo && `BO${e.bo}`,
    e.bo_final && `Final BO${e.bo_final}`,
  ].filter(Boolean)
  return parts.length ? parts.join(" · ") : null
}

/** "5v5 · 5 activos + hasta 2 suplentes". */
export function modeText(
  e: Pick<EventSummary, "game_mode" | "players_per_team" | "subs_max">
) {
  const active = `${e.players_per_team} ${e.players_per_team === 1 ? "activo" : "activos"}`
  if (e.subs_max === 0) return `${e.game_mode} · ${active}, sin suplentes`
  const subs = `${e.subs_max} ${e.subs_max === 1 ? "suplente" : "suplentes"}`
  return `${e.game_mode} · ${active} + hasta ${subs}`
}

/** Si las inscripciones ya cerraron (sin fecha de cierre, siguen abiertas hasta el fixture). */
export const registrationClosed = (
  e: Pick<EventSummary, "registration_closes_at">,
  now = new Date()
) => !!e.registration_closes_at && parseISO(e.registration_closes_at) <= now

/** "cierra en 2 d", "cierra en 5 h", "cierra en 20 min" o "cerrado". */
export function closesText(iso: string, now = new Date()) {
  const minutes = differenceInMinutes(parseISO(iso), now)
  if (minutes <= 0) return "cerrado"
  if (minutes < 60) return `cierra en ${minutes} min`
  if (minutes < 48 * 60) return `cierra en ${Math.floor(minutes / 60)} h`
  return `cierra en ${Math.floor(minutes / (24 * 60))} d`
}

/** Fecha y hora del cierre ("05 nov, 21:00"). */
export const closesAt = (iso: string) =>
  format(parseISO(iso), "dd MMM, HH:mm", { locale: es })

/** "Grupos + playoffs · 2 grupos, clasifican 2". */
export function formatText(template: Template, config: Config) {
  const label = TEMPLATE_LABEL[template]
  if (template === "groups" || template === "groups_double") {
    const groups = num(config.groups) ?? 2
    const advance = num(config.advance) ?? (template === "groups" ? 2 : 3)
    return `${label} · ${groups} grupos, clasifican ${advance}`
  }
  if (template === "swiss") {
    const stages = num(config.stages) ?? 1
    const size = num(config.size) ?? 16
    return `${label} · ${stages === 1 ? "1 fase" : `${stages} fases`} de ${size}`
  }
  return label
}

/** Fecha corta de un día ("02 ago"). */
export const shortDay = (iso: string) =>
  format(parseISO(iso), "dd MMM", { locale: es })

/** "05 jul – 02 ago". */
export function dateRange(from: string | null, to: string | null) {
  if (from && to) return `${shortDay(from)} – ${shortDay(to)}`
  if (from) return `Desde el ${shortDay(from)}`
  if (to) return `Hasta el ${shortDay(to)}`
  return "Fechas por definir"
}

export const prizeText = (prize: string | null) => prize?.trim() || "Sin premio"

/** Cupos libres; null si el torneo no tiene máximo. */
export const freeSlots = (e: Pick<EventSummary, "teams" | "max_teams">) =>
  e.max_teams == null ? null : Math.max(0, e.max_teams - e.teams)

/** Avance del torneo: partidas terminadas sobre las armadas (el backend no cuenta los libres). */
export const progressRatio = (p: EventSummary["progress"]) =>
  p && p.total > 0 ? p.played / p.total : 0

/** "Semifinal · Mapa 2 de 3 · de_dust2". */
export function liveText(m: LiveMatch) {
  return [
    m.label,
    m.maps_total > 1 && `Mapa ${m.map_index} de ${m.maps_total}`,
    m.map,
  ]
    .filter(Boolean)
    .join(" · ")
}

// ---- Llave ----

const BRACKET_STAGES = ["upper", "lower", "ko", "third", "grand"] as const
type BracketStage = (typeof BRACKET_STAGES)[number]

const STAGE_TITLE: Record<BracketStage, string> = {
  upper: "Upper",
  lower: "Lower",
  ko: "Playoffs",
  third: "3.er puesto",
  grand: "Gran final",
}

export const groupLetter = (grp: number) => String.fromCharCode(64 + grp)

export type BracketColumn = {
  round: number
  title: string
  bo: number
  games: EventMatch[]
}

export type BracketSection = {
  key: string
  /** null cuando la llave tiene una sola sección (eliminación directa). */
  title: string | null
  columns: BracketColumn[]
  /** La sección que termina en el campeón (la final o la gran final). */
  final: boolean
}

const isBracketStage = (s: string | null): s is BracketStage =>
  (BRACKET_STAGES as readonly string[]).includes(s ?? "")

/** "Grupo A · upper · ronda 1" → "Upper · ronda 1" dentro de la sección del grupo. */
function columnTitle(label: string | null, grp: number | null, round: number) {
  if (!label) return `Ronda ${round}`
  const rest = grp ? label.replace(/^Grupo [A-Z] · /, "") : label
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

/**
 * Secciones de la llave a partir de las partidas: una por etapa (y por grupo en los grupos de
 * doble eliminación), con columnas por ronda y filas por posición. La fase de grupos y el suizo
 * no son llaves: van en Posiciones.
 */
export function buildBracket(
  matches: EventMatch[],
  template: Template
): BracketSection[] {
  const map = new Map<string, EventMatch[]>()
  for (const m of matches) {
    if (m.bye || !isBracketStage(m.stage)) continue
    const key = `${m.grp ?? 0}:${m.stage}`
    map.set(key, [...(map.get(key) ?? []), m])
  }
  const order = (key: string) => {
    const [grp, stage] = key.split(":")
    // Primero los grupos (A, B…), después los playoffs; dentro, el orden de BRACKET_STAGES.
    const g = Number(grp) || 99
    return g * 10 + BRACKET_STAGES.indexOf(stage as BracketStage)
  }
  const keys = [...map.keys()].sort((a, b) => order(a) - order(b))
  const finalStage: BracketStage = template === "double" ? "grand" : "ko"

  const sections = keys.map((key): BracketSection => {
    const games = map.get(key)!
    const { stage, grp } = games[0]
    const rounds = new Map<number, EventMatch[]>()
    for (const g of games)
      rounds.set(g.round ?? 1, [...(rounds.get(g.round ?? 1) ?? []), g])
    const columns = [...rounds.entries()]
      .sort(([a], [b]) => a - b)
      .map(([round, list]) => {
        const sorted = list.toSorted((a, b) => (a.pos ?? 0) - (b.pos ?? 0))
        return {
          round,
          title: columnTitle(sorted[0].label, grp, round),
          bo: sorted[0].best_of,
          games: sorted,
        }
      })
    const base = STAGE_TITLE[stage as BracketStage]
    return {
      key,
      title: grp ? `Grupo ${groupLetter(grp)} · ${base.toLowerCase()}` : base,
      columns,
      final: !grp && stage === finalStage,
    }
  })
  // Eliminación directa sin 3.er puesto: una sola llave, sin título.
  if (sections.length === 1 && sections[0].key === "0:ko")
    sections[0].title = null
  // Una sección de una sola columna con el mismo nombre ("Gran final") no repite el título.
  for (const s of sections)
    if (s.columns.length === 1 && s.columns[0].title === s.title) s.title = null
  return sections
}

export type Side = {
  teamId: string | null
  name: string
  tag: string | null
  logo_url: string | null
  score: number | null
  won: boolean
  lost: boolean
}

/** Los dos lados de una partida, con quién ganó. Sin equipo todavía: "Por definir". */
export function sidesOf(m: EventMatch): [Side, Side] {
  const done = m.status === "finished"
  const side = (s: EventMatch["side1"], n: 1 | 2): Side => ({
    teamId: s.team?.id ?? null,
    name: s.team?.name ?? s.name ?? "Por definir",
    tag: s.team?.tag ?? null,
    logo_url: s.team?.logo_url ?? null,
    score: s.score,
    won: done && m.winner_side === n,
    lost: done && m.winner_side != null && m.winner_side !== n,
  })
  return [side(m.side1, 1), side(m.side2, 2)]
}

export const MATCH_STATUS: Record<
  EventMatch["status"],
  { label: string; className: string }
> = {
  live: { label: "EN VIVO", className: "bg-destructive text-white" },
  upcoming: {
    label: "PRÓXIMA",
    className: "bg-secondary text-secondary-foreground",
  },
  finished: { label: "FINAL", className: "bg-muted text-muted-foreground" },
  cancelled: {
    label: "CANCELADA",
    className: "border text-muted-foreground",
  },
}

/** "– : –" si no se jugó; si no, el marcador de la serie. */
export function scoreText(m: EventMatch) {
  if (m.status === "upcoming" || m.status === "cancelled") return "– : –"
  return `${m.side1.score ?? 0} : ${m.side2.score ?? 0}`
}

// ---- Posiciones ----

export type StandingTable = {
  key: string
  title: string
  stage: Standing["stage"]
  rows: Standing[]
}

/** Una tabla por grupo (o por fase suiza), ordenada por puesto. */
export function standingTables(rows: Standing[]): StandingTable[] {
  const map = new Map<string, Standing[]>()
  for (const r of rows) {
    const key = `${r.stage}:${r.stage === "swiss" ? r.phase : r.grp}`
    map.set(key, [...(map.get(key) ?? []), r])
  }
  return [...map.entries()].map(([key, list]) => {
    const { stage, grp, phase } = list[0]
    return {
      key,
      stage,
      title:
        stage === "swiss" ? `Fase suiza ${phase}` : `Grupo ${groupLetter(grp)}`,
      rows: list.toSorted((a, b) => a.place - b.place),
    }
  })
}

/** Clasifica: lo marca el backend (suizo y doble eliminación) o el puesto en los grupos. */
export function qualifies(row: Standing, advance: number) {
  if (row.state) return row.state === "qualified"
  return row.stage === "group" && row.place <= advance
}

export const advanceOf = (template: Template, config: Config) =>
  num(config.advance) ?? (template === "groups_double" ? 3 : 2)

/** Mensaje de Posiciones sin tablas. */
export function noStandingsText(template: Template) {
  if (template === "single" || template === "double")
    return "Este torneo no tiene fase de grupos."
  if (template === "swiss")
    return "Las fases suizas se arman al cerrar las inscripciones."
  return "Los grupos se sortean al cerrar las inscripciones."
}

// ---- Reglas ----

/** Reglas de la liga del prototipo, para los torneos que no cargan las suyas. */
export const DEFAULT_RULES = [
  "Cada equipo inscribe los activos que pide el modo del torneo y, si lo permite, sus suplentes. Solo juegan miembros del roster.",
  "El veto se hace en la sala de la partida. El equipo 1 empieza baneando.",
  "15 minutos de tolerancia. Pasado ese tiempo, el admin puede dar la partida por perdida.",
  "Se juega en el servidor con `!match` y el código de la partida. Solo juegan los inscritos, sin stand-ins.",
  "Cada mapa queda registrado con su demo y stats. Si hay diferencias en el reporte, decide un admin.",
  "Un jugador no puede estar inscrito con dos equipos en el mismo torneo.",
  "Prohibido el uso de scripts, binds de salto y modificaciones del cliente.",
]

/** Un ítem por línea, sin la numeración o viñeta que traiga el texto. */
export function rulesOf(rules: string | null) {
  const lines = (rules ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim())
    .filter(Boolean)
  return lines.length ? lines : DEFAULT_RULES
}

// ---- CTA ----

export type MyTeamRef = {
  id: string
  name: string
  tag: string | null
  isLeader: boolean
}

export type Cta =
  | { kind: "register"; teams: MyTeamRef[]; free: number | null }
  | { kind: "full" }
  | { kind: "registered"; team: MyTeamRef; closed: boolean }
  | { kind: "closed"; at: string }
  | { kind: "ask-leader"; team: MyTeamRef; registered: boolean }
  | { kind: "no-team" }
  | { kind: "live"; match: LiveMatch }
  | { kind: "matches"; stage: string | null }
  | { kind: "champion"; team: { id: string; name: string }; on: string | null }
  | { kind: "none" }

/** Botón de la cabecera según el estado del torneo y los equipos del usuario. */
export function ctaFor({
  event,
  myTeams,
  registeredIds,
  now = new Date(),
}: {
  event: Pick<
    EventDetail,
    | "status"
    | "teams"
    | "max_teams"
    | "champion"
    | "ends_on"
    | "registration_closes_at"
    | "live_match"
    | "current_stage"
  >
  myTeams: MyTeamRef[]
  registeredIds: ReadonlySet<string>
  now?: Date
}): Cta {
  if (event.status === "registration") {
    const closed = registrationClosed(event, now)
    const leading = myTeams.filter((t) => t.isLeader)
    const mine = leading.find((t) => registeredIds.has(t.id))
    if (mine) return { kind: "registered", team: mine, closed }
    if (leading.length && closed && event.registration_closes_at)
      return { kind: "closed", at: event.registration_closes_at }
    if (leading.length) {
      const free = freeSlots(event)
      return free === 0
        ? { kind: "full" }
        : { kind: "register", teams: leading, free }
    }
    const member = myTeams.find((t) => registeredIds.has(t.id)) ?? myTeams[0]
    if (member)
      return {
        kind: "ask-leader",
        team: member,
        registered: registeredIds.has(member.id),
      }
    return { kind: "no-team" }
  }
  if (event.status === "in_progress") {
    return event.live_match
      ? { kind: "live", match: event.live_match }
      : { kind: "matches", stage: event.current_stage }
  }
  if (event.status === "finished" && event.champion)
    return { kind: "champion", team: event.champion, on: event.ends_on }
  return { kind: "none" }
}
