type Side = { name: string | null; score: number | null }

/** Lo que usa la tarjeta de un mix interrumpido (sale del listado de partidas). */
export type MatchSummary = {
  id: string
  map: string | null
  played_at: string | null
  starts_at: string | null
  side1: Side
  side2: Side
}

/** Bando que iba adelante (el que gana si se aplica el ELO). Null si iban empatados. */
export function leadingSide(m: MatchSummary): string | null {
  const a = m.side1.score ?? 0
  const b = m.side2.score ?? 0
  if (a === b) return null
  return (
    (a > b ? m.side1.name : m.side2.name) ?? (a > b ? "Bando 1" : "Bando 2")
  )
}
