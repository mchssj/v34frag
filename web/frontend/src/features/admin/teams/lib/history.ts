// Textos del historial de un equipo (team_audit) y de las acciones del staff.

type Entry = {
  action: string
  data: Record<string, unknown>
  actor_role: "team" | "support" | "moderator" | "admin" | "system"
}

const ROLE: Record<string, string> = {
  player: "jugador",
  sub: "suplente",
  coach: "coach",
}

const s = (v: unknown) => (typeof v === "string" ? v : "")

/** Qué pasó, en una frase ("cambió el nombre de «A» a «B»"). */
export function historyText(e: Entry): string {
  const d = e.data
  switch (e.action) {
    case "created":
      return `creó el equipo «${s(d.name)}»`
    case "renamed":
      return s(d.old_name) === s(d.name)
        ? `cambió la sigla de ${s(d.old_tag)} a ${s(d.tag)}`
        : `cambió el nombre de «${s(d.old_name)}» a «${s(d.name)}»`
    case "logo_changed":
      return "cambió el logo"
    case "logo_removed":
      return "quitó el logo"
    case "captain_changed":
      return s(d.to)
        ? `cambió el líder a ${s(d.to)}`
        : "dejó al equipo sin líder"
    case "member_added":
      return `sumó a ${s(d.player)}${ROLE[s(d.role)] && s(d.role) !== "player" ? ` como ${ROLE[s(d.role)]}` : ""}`
    case "member_removed":
      return `sacó a ${s(d.player)} del plantel`
    case "member_left":
      return `${s(d.player)} salió del equipo`
    case "role_changed":
      return `pasó a ${s(d.player)} de ${ROLE[s(d.from)] ?? s(d.from)} a ${ROLE[s(d.to)] ?? s(d.to)}`
    case "dissolved":
      return "disolvió el equipo"
    default:
      return e.action
  }
}

export const ACTOR_LABEL: Record<Entry["actor_role"], string> = {
  team: "Equipo",
  support: "Soporte",
  moderator: "Moderador",
  admin: "Admin",
  system: "Sistema",
}

/** El aviso que recibe el líder, para mostrarlo antes de confirmar una acción. */
export function staffNotice(
  by: "admin" | "moderator",
  action: string,
  player?: string
): string {
  const who = by === "admin" ? "Un admin" : "Un moderador"
  const what: Record<string, string> = {
    rename: "cambió el nombre del equipo",
    logo: "quitó el logo del equipo",
    kick: `sacó a ${player ?? "un jugador"} del equipo`,
    captain: `pasó el liderazgo a ${player ?? "otro jugador"}`,
    add: `sumó a ${player ?? "un jugador"} al equipo`,
    role: `cambió el rol de ${player ?? "un jugador"}`,
    dissolve: "disolvió el equipo",
  }
  return `${who} ${what[action] ?? "hizo un cambio en el equipo"}`
}
