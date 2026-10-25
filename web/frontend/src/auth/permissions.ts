import type { Role } from "./queries"

// Reglas por rol de cuenta, en un solo lugar. Provisorio: los roles de la plataforma están por
// definir (ver CLAUDE.md). Los permisos por contexto (capitán, gestor de un torneo) los da la API.

export const ADMIN_SECTIONS = [
  "events",
  "players",
  "teams",
  "servers",
  "users",
] as const
export type AdminSection = (typeof ADMIN_SECTIONS)[number]

/** El grupo Administración: organizador y admin. */
export const canSeeAdmin = (role: Role) =>
  role === "admin" || role === "organizer"

/** Admin entra a todo; el organizador solo a Torneos. */
export const canAccessAdminSection = (role: Role, section: AdminSection) =>
  role === "admin" || (role === "organizer" && section === "events")

/** Sección de `/admin/{sección}`, o null si la ruta no es una sección conocida. */
export function adminSectionOf(pathname: string): AdminSection | null {
  const section = pathname.match(/^\/admin\/([^/]+)/)?.[1]
  return ADMIN_SECTIONS.find((s) => s === section) ?? null
}

/** Borrar un mix desde su sala: solo admin (contrato, admin.md). */
export const canDeleteMix = (role: Role) => role === "admin"

/** Notificaciones de capitán (PCW, veto): capitanes y admin. */
export const seesCaptainNotifications = (role: Role, isCaptain: boolean) =>
  isCaptain || role === "admin"
