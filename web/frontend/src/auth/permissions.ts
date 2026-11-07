import type { Role } from "./queries"

// Reglas por rol de cuenta, en un solo lugar. Provisorio: los roles de la plataforma están por
// definir (ver CLAUDE.md). Los permisos por contexto (capitán, gestor de un torneo) los da la API.

export const ADMIN_SECTIONS = [
  "events",
  "players",
  "teams",
  "servers",
  "matchmaking",
  "seasons",
  "clips",
  "ranking",
  "maps",
  "users",
  "bans",
] as const
export type AdminSection = (typeof ADMIN_SECTIONS)[number]

/** El grupo Administración: organizador, moderador y admin. */
export const canSeeAdmin = (role: Role) =>
  role === "admin" || role === "organizer" || role === "moderator"

/** Admin entra a todo; el organizador solo a Torneos (los suyos) y el moderador a Torneos, Equipos y Baneos. */
export const canAccessAdminSection = (role: Role, section: AdminSection) =>
  role === "admin" ||
  (role === "organizer" && section === "events") ||
  (role === "moderator" &&
    (section === "bans" || section === "events" || section === "teams"))

/** Primera sección de Administración a la que entra cada rol. */
export const homeAdminSection = (role: Role): AdminSection =>
  role === "moderator" ? "bans" : "events"

/** Baneos (banear, cambiar y levantar): moderador y admin. Los permanentes, solo admin. */
export const canModerate = (role: Role) =>
  role === "admin" || role === "moderator"

/** Sección de `/admin/{sección}`, o null si la ruta no es una sección conocida. */
export function adminSectionOf(pathname: string): AdminSection | null {
  const section = pathname.match(/^\/admin\/([^/]+)/)?.[1]
  return ADMIN_SECTIONS.find((s) => s === section) ?? null
}

/** Borrar un mix desde su sala: solo admin (contrato, admin.md). */
export const canDeleteMix = (role: Role) => role === "admin"

/** Las notificaciones de Administración: admins, y moderadores para las de torneos y mixes por aprobar (contrato notificaciones.md). */
export const getsAdminNotifications = (role: Role) =>
  role === "admin" || role === "moderator"

/** Crear un torneo normal: admin u organizador (el del organizador queda pendiente de aprobación). */
export const canCreateEvent = (role: Role) =>
  role === "admin" || role === "organizer"

/** Subir un torneo histórico: admin, moderador u organizador (el del organizador queda pendiente). */
export const canCreateHistoricEvent = (role: Role) =>
  role === "admin" || role === "moderator" || role === "organizer"

/** Aprobar torneos y mixes vinculados, y la fase de testing: moderador y admin. */
export const canReviewEvents = (role: Role) =>
  role === "admin" || role === "moderator"

/** Baneos permanentes (poner, cambiar o levantar uno): solo admin. */
export const canBanPermanent = (role: Role) => role === "admin"
