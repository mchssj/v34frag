// Formulario de cambio de contraseña (Mi perfil → Cuenta), con las reglas y textos del handoff.
// El backend acepta de 6 a 72 caracteres; acá se pide más (8 y al menos 2 puntos).

import { differenceInSeconds, parseISO } from "date-fns"

import { timeAgo } from "@/features/shell/notifications/model"

/**
 * "Último cambio hace X" (`password_changed_at`). null si no hay fecha: solo se guarda desde el
 * 2026-10-19, así que una cuenta que no la cambió desde entonces no muestra nada.
 */
export function passwordChangedText(
  changedAt: string | null | undefined,
  now = new Date()
): string | null {
  if (!changedAt) return null
  return differenceInSeconds(now, parseISO(changedAt)) < 60
    ? "Último cambio hace un momento"
    : `Último cambio ${timeAgo(changedAt, now)}`
}

export type Tone = "muted" | "win" | "destructive"

export type PasswordFeedback = {
  /** 0–4: un punto por cada uno de ≥ 8 caracteres, mayúscula, número y símbolo. */
  score: number
  current: { error: string | null }
  next: { message: string; tone: Tone; invalid: boolean }
  confirm: { message: string | null; tone: Tone; border: Tone }
  canSave: boolean
}

const LABELS = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"]

export const passwordScore = (q: string) =>
  Number(q.length >= 8) +
  Number(/[A-Z]/.test(q)) +
  Number(/[0-9]/.test(q)) +
  Number(/[^A-Za-z0-9]/.test(q))

export function passwordFeedback({
  current,
  next,
  confirm,
  tried,
  serverError,
}: {
  current: string
  next: string
  confirm: string
  /** Se tocó "Guardar" con datos inválidos. */
  tried: boolean
  /** Rechazo del backend: la actual no es correcta o la nueva es igual. */
  serverError: "wrong" | "same" | null
}): PasswordFeedback {
  const score = passwordScore(next)
  const same = (!!next && next === current) || serverError === "same"
  const nextOk = next.length >= 8 && score >= 2 && !same
  const confirmOk = !!confirm && confirm === next
  // "No coinciden" recién cuando ya escribió el mismo largo o intentó guardar.
  const mismatch =
    !!confirm && !confirmOk && (tried || confirm.length >= next.length)

  const nextBad = same || (tried && !nextOk)
  return {
    score,
    current: {
      error:
        serverError === "wrong"
          ? "La contraseña actual no es correcta."
          : tried && !current
            ? "Ingresa tu contraseña actual."
            : null,
    },
    next: {
      message: same
        ? "Tiene que ser distinta de la actual."
        : tried && !nextOk
          ? "Muy débil. Usa al menos 8 caracteres, con números o mayúsculas."
          : !next
            ? "Usa al menos 8 caracteres, con números y mayúsculas."
            : LABELS[score],
      tone: nextBad ? "destructive" : "muted",
      invalid: nextBad,
    },
    confirm: {
      message: confirmOk ? "Coinciden" : mismatch ? "No coinciden" : null,
      tone: confirmOk ? "win" : "destructive",
      border: confirmOk ? "win" : mismatch ? "destructive" : "muted",
    },
    canSave: !!current && nextOk && confirmOk,
  }
}
