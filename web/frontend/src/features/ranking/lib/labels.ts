import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

// Textos y cálculos de presentación de Ranking (handoff_ranking y contratos 5c, 7 y 8f).

/** "{rol} · {país}"; con perfil privado vienen null y se omiten. Null si no queda nada. */
export function roleCountry(
  role: string | null | undefined,
  country: string | null | undefined
): string | null {
  const parts = [role, country].filter(Boolean)
  return parts.length ? parts.join(" · ") : null
}

/** Rating y K/D con dos decimales; null → "—". */
export function fmt2(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : v.toFixed(2)
}

/** Porcentaje redondeado; null → "—". */
export function fmtPct(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${Math.round(v)}%`
}

export type Trend = {
  text: string
  tone: "up" | "down" | "flat"
  title: string
}

/** Puestos que subió o bajó un equipo desde hace 30 días (contrato 7). */
export function teamTrend(trend: number | null, position: number): Trend {
  if (trend === null)
    return { text: "–", tone: "flat", title: "Sin partidas hace 30 días" }
  if (trend === 0)
    return { text: "–", tone: "flat", title: "Igual que hace 30 días" }
  return {
    text: trend > 0 ? `▲${trend}` : `▼${-trend}`,
    tone: trend > 0 ? "up" : "down",
    title: `Hace 30 días: ${position + trend}.º`,
  }
}

/** Cuenta regresiva hasta el cierre: días, horas y minutos (null si ya pasó). */
export function countdown(
  endsAt: string,
  now: number = Date.now()
): { d: number; h: number; m: number } | null {
  const ms = parseISO(endsAt).getTime() - now
  if (ms <= 0) return null
  return {
    d: Math.floor(ms / 86_400_000),
    h: Math.floor((ms % 86_400_000) / 3_600_000),
    m: Math.floor((ms % 3_600_000) / 60_000),
  }
}

/** "12 de noviembre de 2026". */
export function fmtLongDate(iso: string): string {
  return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: es })
}

/** Ancho de la barra del comparador (0 a 100) contra el mayor de los dos. */
export function barPct(v: number | null, other: number | null): number {
  if (v === null || v <= 0) return 0
  const max = Math.max(v, other ?? 0)
  return Math.round((v / max) * 100)
}

/** Lado que gana una fila del comparador ("a" en empate, como el handoff); null si falta uno. */
export function compareWinner(
  a: number | null,
  b: number | null
): "a" | "b" | null {
  if (a === null || b === null) return null
  return a >= b ? "a" : "b"
}
