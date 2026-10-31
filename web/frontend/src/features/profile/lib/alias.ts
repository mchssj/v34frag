import { differenceInCalendarDays, format, isAfter, parseISO } from "date-fns"
import { es } from "date-fns/locale"

import type { AliasState } from "@/features/auth/register/useAliasStatus"

export type AliasFeedback = {
  message: string
  tone: "muted" | "win" | "destructive"
  icon: "at" | "ok" | "error" | "lock"
  canSave: boolean
  /** "Último cambio hace N días" o "Podrás cambiarlo el…"; null si no se conoce la fecha. */
  chip: string | null
}

const ago = (days: number) => (days === 0 ? "un momento" : `${days} días`)

/**
 * Estado del cambio de alias en Mi perfil, con los textos del diseño. Las fechas salen de la
 * respuesta de `PUT /me/alias` (la API todavía no las da al cargar el perfil).
 */
export function aliasFeedback({
  value,
  current,
  state,
  changedAt,
  nextChangeAt,
  now = new Date(),
}: {
  value: string
  current: string
  state: AliasState
  changedAt: string | null
  nextChangeAt: string | null
  now?: Date
}): AliasFeedback {
  const days = changedAt
    ? differenceInCalendarDays(now, parseISO(changedAt))
    : null
  const next = nextChangeAt ? parseISO(nextChangeAt) : null

  if (next && isAfter(next, now)) {
    return {
      message: `Lo cambiaste hace ${ago(days ?? 0)}. Se puede cambiar una vez cada 15 días.`,
      tone: "muted",
      icon: "lock",
      canSave: false,
      chip: `Podrás cambiarlo el ${format(next, "d MMM", { locale: es })}`,
    }
  }
  const chip = days !== null ? `Último cambio hace ${ago(days)}` : null
  const same = value.trim().toLowerCase() === current.toLowerCase()
  const error =
    same || state === "idle"
      ? null
      : state === "short"
        ? "Entre 2 y 24 caracteres."
        : state === "taken"
          ? "Ese alias ya está en uso."
          : state === "blocked"
            ? "Contiene una palabra no permitida."
            : null

  if (error)
    return {
      message: error,
      tone: "destructive",
      icon: "error",
      canSave: false,
      chip,
    }
  if (!same && state === "available")
    return {
      message: "Disponible. Después de cambiarlo tendrás que esperar 15 días.",
      tone: "win",
      icon: "ok",
      canSave: true,
      chip,
    }
  // Sin verificar (red) también se puede intentar: el backend valida al guardar.
  return {
    message: "2 a 24 caracteres. Único en la web.",
    tone: "muted",
    icon: "at",
    canSave: !same && state === "unknown",
    chip,
  }
}
