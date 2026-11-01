// Reglas de presentación del registro (handoff, sección 2b).

/** Puntaje 0–4: largo ≥ 8, mayúscula, número y símbolo. */
export function passwordScore(password: string): number {
  return (
    Number(password.length >= 8) +
    Number(/[A-Z]/.test(password)) +
    Number(/[0-9]/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password))
  )
}

const LABELS = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"]

export function passwordLabel(password: string): string {
  if (!password) return "Usa al menos 8 caracteres, con números y mayúsculas."
  return LABELS[passwordScore(password)]
}

/** "ju••••@dominio.com": 2 primeros caracteres + hasta 6 puntos. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@")
  if (at < 0) return email
  const user = email.slice(0, at)
  const domain = email.slice(at + 1)
  const masked =
    user.length <= 2
      ? user
      : user.slice(0, 2) + "•".repeat(Math.min(6, user.length - 2))
  return `${masked}@${domain}`
}
