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
  "medals",
  "clips",
  "ranking",
  "maps",
  "users",
  "bans",
] as const
export type AdminSection = (typeof ADMIN_SECTIONS)[number]

/** El grupo Administración: organizador, soporte, moderador y admin. */
export const canSeeAdmin = (role: Role) =>
  role === "admin" ||
  role === "organizer" ||
  role === "support" ||
  role === "moderator"

/**
 * Admin entra a todo; el organizador solo a Torneos (los suyos); el soporte a Baneos y Clips (replanteo 117), y el
 * moderador a Torneos, Equipos, Baneos y Clips (puede todo lo del soporte).
 */
export const canAccessAdminSection = (role: Role, section: AdminSection) =>
  role === "admin" ||
  (role === "organizer" && section === "events") ||
  (role === "support" && (section === "bans" || section === "clips")) ||
  (role === "moderator" &&
    (section === "bans" ||
      section === "events" ||
      section === "teams" ||
      section === "clips"))

/** Primera sección de Administración a la que entra cada rol. */
export const homeAdminSection = (role: Role): AdminSection =>
  role === "moderator" || role === "support" ? "bans" : "events"

/** Soporte (replanteo 117): solo eso, no un moderador ni un admin. Banea por minutos y solo toca sus baneos. */
export const isSupportOnly = (role: Role) => role === "support"

/**
 * Lo del soporte (replanteo 117): baneos cortos, denuncias de comentarios, sanciones de la cola, quitar fotos de perfil
 * y logos de equipo, y reprocesar clips. También el moderador y el admin.
 */
export const canSupport = (role: Role) =>
  role === "admin" || role === "moderator" || role === "support"

/**
 * La cola Para revisar de Clips: publicar en Discord, reprocesar otra vez y rechazar (replanteo 117; Daniel, 2026-11-14).
 * Soporte, moderador y admin.
 */
export const canReviewClips = canSupport

/** Las reglas de Clips, rechazar varios a la vez, recuperar rechazados y reprocesar hasta 50: solo admin. */
export const canManageClips = (role: Role) => role === "admin"

/** La pestaña Actividad del soporte de Baneos: moderador y admin. */
export const canSeeSupportActivity = (role: Role) =>
  role === "admin" || role === "moderator"

/** Insignia de verificado (replanteo 90): solo admin. */
export const canVerifyPlayers = (role: Role) => role === "admin"

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

/** Crear un torneo normal: admin, moderador u organizador (lo de los dos últimos queda pendiente de aprobación). */
export const canCreateEvent = (role: Role) =>
  role === "admin" || role === "moderator" || role === "organizer"

/** Subir un torneo histórico: admin, moderador u organizador (lo de los dos últimos queda pendiente). */
export const canCreateHistoricEvent = (role: Role) =>
  role === "admin" || role === "moderator" || role === "organizer"

/**
 * Quién aprueba lo que crea cada rol (replanteo 84): lo del admin nace aprobado, lo del organizador lo aprueba
 * un admin o un moderador, y lo del moderador, solo un admin.
 */
export const eventApprover = (role: Role): "none" | "staff" | "admin" =>
  role === "admin" ? "none" : role === "moderator" ? "admin" : "staff"

/** Aprobar torneos y mixes vinculados, y la fase de testing: moderador y admin. */
export const canReviewEvents = (role: Role) =>
  role === "admin" || role === "moderator"

/** Baneos permanentes (poner, cambiar o levantar uno): solo admin. */
export const canBanPermanent = (role: Role) => role === "admin"
