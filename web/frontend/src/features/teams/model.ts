import type { Schemas } from "@/api/client"
import type { RosterEntry, TeamDetail } from "./queries"

// Lógica pura de la vista de equipo (handoff_equipo).

export type RosterStatus = "player" | "sub" | "coach"
export type MyRole = "leader" | RosterStatus

// El máximo lo configura el admin (`max_members`); 10 es el valor por defecto del backend, para
// cuando un equipo no lo trae.
export const MAX_ROSTER = 10

export const STATUS_LABEL: Record<RosterStatus, string> = {
  player: "Activo",
  sub: "Suplente",
  coach: "Coach",
}

/** Rol del usuario en un equipo, como lo muestra el selector "Mis equipos". */
export const MY_ROLE_LABEL: Record<MyRole, string> = {
  leader: "líder",
  player: "activo",
  sub: "suplente",
  coach: "coach",
}

const asStatus = (role: string): RosterStatus =>
  role === "sub" || role === "coach" ? role : "player"

export type RosterGroup = {
  status: RosterStatus
  label: string
  members: RosterEntry[]
}

/** Activos, Suplentes y Coach, en ese orden; los grupos vacíos no se muestran. */
export function rosterGroups(members: RosterEntry[]): RosterGroup[] {
  const groups: RosterGroup[] = [
    { status: "player", label: "Activos", members: [] },
    { status: "sub", label: "Suplentes", members: [] },
    { status: "coach", label: "Coach", members: [] },
  ]
  for (const m of members)
    groups.find((g) => g.status === asStatus(m.role))!.members.push(m)
  return groups.filter((g) => g.members.length > 0)
}

export const statusOf = (m: RosterEntry) => asStatus(m.role)

/** Lo que va en el escudo: la sigla o, si no tiene, las iniciales del nombre (hasta 3). */
export function crestText(team: { name: string; tag: string | null }) {
  const tag = team.tag?.trim()
  if (tag) return tag.toUpperCase().slice(0, 4)
  const words = team.name.trim().split(/\s+/).filter(Boolean)
  const initials =
    words.length > 1
      ? words.map((w) => w[0]).join("")
      : (words[0] ?? "?").slice(0, 3)
  return initials.toUpperCase().slice(0, 3)
}

/** % de victorias del récord oficial, o null sin partidas jugadas. */
export function winRate(record: TeamDetail["record"]): number | null {
  const r = record?.official
  if (!r || r.played === 0) return null
  return Math.round((r.won / r.played) * 100)
}

type Ranking = Schemas["Ranking"]["items"]

export const rankOf = (ranking: Ranking | undefined, teamId: string) =>
  ranking?.find((r) => r.team.id === teamId)?.position ?? null

/** Torneos terminados que ganó el equipo (Vitrina y KPI "Títulos"). */
// Genérico: el tipo generado de `champion` es un allOf nullable difícil de usar.
export function titlesOf<T extends { champion: { id: string } | null }>(
  events: T[] | undefined,
  teamId: string
): T[] {
  return (events ?? []).filter((e) => e.champion?.id === teamId)
}

export type MatchResult = {
  id: string
  opponent: string
  /** null mientras no terminó o sin ganador. */
  won: boolean | null
  live: boolean
  score: string
  context: string
}

// Tipo estructural: el generado para `team` de cada bando es un allOf nullable difícil de usar.
type Side = {
  name: string | null
  team: { id: string; name: string } | null
  score: number | null
}
export type MatchLike = {
  id: string
  kind: "mix" | "pcw" | "official"
  status: "upcoming" | "live" | "finished" | "cancelled"
  label: string | null
  event: { name: string } | null
  winner_side: number | null
  side1: Side
  side2: Side
}

/** Una partida vista desde el equipo: rival, marcador y si la ganó. */
export function resultFor(match: MatchLike, teamId: string): MatchResult {
  const mine = match.side2.team?.id === teamId ? 2 : 1
  const us = mine === 1 ? match.side1 : match.side2
  const them = mine === 1 ? match.side2 : match.side1
  const live = match.status === "live"
  const won =
    match.status === "finished" && match.winner_side !== null
      ? match.winner_side === mine
      : null
  const context = [
    match.event?.name ?? (match.kind === "pcw" ? "PCW" : null),
    match.label,
    live ? "en vivo" : null,
  ]
    .filter(Boolean)
    .join(" · ")
  return {
    id: match.id,
    opponent: them.team?.name ?? them.name ?? "Por definir",
    won,
    live,
    score: `${us.score ?? 0} : ${them.score ?? 0}`,
    context,
  }
}

export type JoinState = "signin" | "member" | "full" | "sent" | "join"

/** Estado del botón "Pedir entrar" de la vista pública y de Buscar equipo. */
export function joinState({
  signedIn,
  isMember,
  members,
  maxMembers,
  hasRequest,
}: {
  signedIn: boolean
  isMember: boolean
  members: number
  maxMembers: number | null
  hasRequest: boolean
}): JoinState {
  if (!signedIn) return "signin"
  if (isMember) return "member"
  if (hasRequest) return "sent"
  if (members >= (maxMembers ?? MAX_ROSTER)) return "full"
  return "join"
}

// --- Roles de juego (el puesto que cada jugador eligió en su perfil) -------

/** Lugares del mapa de roles; "Entry fragger" del perfil va en Entry. */
export const ROLE_SLOTS = [
  "Entry",
  "Support",
  "Lurker",
  "IGL",
  "AWPer",
] as const
export type RoleSlot = (typeof ROLE_SLOTS)[number]

const SLOT_OF: Record<string, RoleSlot> = {
  Entry: "Entry",
  "Entry fragger": "Entry",
  Support: "Support",
  Lurker: "Lurker",
  IGL: "IGL",
  AWPer: "AWPer",
}

/**
 * Reparte el roster en los lugares del mapa por su `game_role`. Varios pueden compartir un lugar;
 * los demás puestos (Rifler, Otro) y los que no eligieron quedan en `others`. El coach no juega.
 */
export function rolesMap(members: RosterEntry[]) {
  const slots = Object.fromEntries(
    ROLE_SLOTS.map((s) => [s, [] as RosterEntry[]])
  ) as Record<RoleSlot, RosterEntry[]>
  const others: RosterEntry[] = []
  for (const m of members) {
    if (asStatus(m.role) === "coach") continue
    const slot = m.game_role ? SLOT_OF[m.game_role] : undefined
    if (slot) slots[slot].push(m)
    else others.push(m)
  }
  return { slots, others }
}

// --- Historial de torneos -------------------------------------------------

type EventResult = Schemas["TeamEvent"]["result"]

/** Etiqueta y tono del chip de resultado (como en el handoff: campeón naranja, en curso rojo). */
export const RESULT_LABEL: Record<
  EventResult,
  { label: string; tone: "win" | "live" | "mid" }
> = {
  champion: { label: "Campeón", tone: "win" },
  runner_up: { label: "Subcampeón", tone: "mid" },
  semifinal: { label: "Semifinal", tone: "mid" },
  quarterfinal: { label: "Cuartos de final", tone: "mid" },
  groups: { label: "Fase de grupos", tone: "mid" },
  eliminated: { label: "Eliminado", tone: "mid" },
  in_progress: { label: "En curso", tone: "live" },
  registered: { label: "Inscripto", tone: "mid" },
}

/** "3.er puesto" cuando el backend lo sabe y no es campeón ni subcampeón. */
export function resultText(result: EventResult, place: number | null) {
  if (result === "semifinal" && place === 3) return "3.er puesto"
  if (result === "semifinal" && place === 4) return "4.º puesto"
  return RESULT_LABEL[result].label
}

// --- Qué busca el equipo (looking_for) ------------------------------------

export type LookingFor = RosterStatus

export const LOOKING_FOR: {
  id: LookingFor
  label: string
  hint: string
}[] = [
  { id: "player", label: "Activo", hint: "Para el quinteto titular" },
  { id: "sub", label: "Suplente", hint: "Para cubrir bajas y rotar" },
  { id: "coach", label: "Coach", hint: "Estrategia y análisis" },
]

/** "Busca activo", "Busca suplente", "Busca coach". */
export const lookingForText = (w: LookingFor) =>
  `Busca ${STATUS_LABEL[w].toLowerCase()}`

/**
 * A quién le puede ceder el liderazgo el líder antes de salir: los demás miembros, con SteamID (lo
 * pide el backend para el capitán).
 */
export function heirsOf(members: RosterEntry[]) {
  return members
    .filter((m) => !m.is_captain)
    .map((m) => ({ member: m, eligible: m.has_steam }))
}
