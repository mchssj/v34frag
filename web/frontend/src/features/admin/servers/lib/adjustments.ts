export type Mode = "delta" | "set"

/** Valida el valor según el modo (contrato: −500 a +500 sin 0, o fijar de 0 a 10000). */
export function adjustValueError(mode: Mode, raw: string): string | null {
  const t = raw.trim()
  const v = Number(t)
  if (!t || !Number.isInteger(v)) return "Un número entero."
  if (mode === "delta" && (v === 0 || v < -500 || v > 500))
    return "De −500 a +500, sin 0."
  if (mode === "set" && (v < 0 || v > 10000)) return "De 0 a 10000."
  return null
}

/** Cómo queda el ELO (se calcula en el navegador; la API devuelve el real). */
export function adjustedElo(
  elo: number,
  mode: Mode,
  value: number,
  floor: number
): number {
  return Math.max(floor, mode === "delta" ? elo + value : value)
}
