import type { SupportAction, SupportActionKind } from "../types"

// Baneos › Actividad del soporte (replanteo 117): cómo se cuenta cada acción. Sin React.

export const SUPPORT_ACTION_LABEL: Record<SupportActionKind, string> = {
  ban: "Baneos",
  ban_update: "Baneos cambiados",
  ban_lift: "Baneos levantados",
  clip_reprocess: "Clips reprocesados",
  clip_approve: "Clips publicados",
  clip_reject: "Clips rechazados",
  photo_remove: "Fotos quitadas",
  logo_remove: "Logos quitados",
  comment_delete: "Comentarios borrados",
  comment_report: "Denuncias resueltas",
  penalty_lift: "Sanciones de la cola levantadas",
}

const str = (v: unknown) => (typeof v === "string" ? v : "")

/** Lo que hizo, en una frase sin el autor ("baneó a X hasta las 21:30"). `fmt` da formato a una fecha. */
export function supportActionText(
  a: SupportAction,
  fmt: (iso: string) => string
): string {
  const t = a.target
  const who = a.player?.alias ?? (str(t.nick) || "un jugador")
  const until = str(t.expires_at)
  switch (a.action) {
    case "ban":
      return `baneó a ${who}${until ? ` hasta el ${fmt(until)}` : ""}`
    case "ban_update":
      return `cambió el baneo de ${who}${until ? `: ahora vence el ${fmt(until)}` : ""}`
    case "ban_lift":
      return `levantó el baneo de ${who}`
    case "clip_reprocess":
      return "reprocesó un clip"
    case "clip_approve":
      return `publicó en Discord un clip de ${who}`
    case "clip_reject":
      return `rechazó un clip de ${who}`
    case "photo_remove":
      return `quitó la foto de perfil de ${who}`
    case "logo_remove":
      return `quitó el logo de ${a.team?.name ?? "un equipo"}`
    case "comment_delete":
      return `borró un comentario del perfil de ${who}`
    case "comment_report":
      return t.decision === "delete"
        ? `borró un comentario denunciado del perfil de ${who}`
        : `descartó una denuncia de un comentario del perfil de ${who}`
    case "penalty_lift":
      return `levantó la sanción de la cola de ${who}`
  }
}

/** El texto del comentario, si la acción fue sobre uno (para mostrarlo citado). */
export const supportActionQuote = (a: SupportAction) =>
  a.action === "comment_delete" || a.action === "comment_report"
    ? str(a.target.body) || null
    : null
