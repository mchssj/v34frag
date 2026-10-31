import { format, formatDistanceToNowStrict, parseISO } from "date-fns"
import { es } from "date-fns/locale"

// Textos de presentación de Administración (diseño aprobado el 2026-10-28).

/** Texto que piden las dobles confirmaciones (contrato, admin.md). */
export const CONFIRM_TEXT = "estoy seguro"

/** Sin distinguir mayúsculas ni espacios en los bordes, como la API. */
export const isConfirmText = (s: string) =>
  s.trim().toLowerCase() === CONFIRM_TEXT

/** "4 nov 2026". */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return format(parseISO(iso), "d MMM yyyy", { locale: es })
}

/** "4 nov 2026, 21:40". */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  return format(parseISO(iso), "d MMM yyyy, HH:mm", { locale: es })
}

/** "hace 3 minutos". */
export function ago(iso: string | null | undefined): string {
  if (!iso) return "nunca"
  return formatDistanceToNowStrict(parseISO(iso), {
    locale: es,
    addSuffix: true,
  })
}

/** Pasó más de `ms` desde la fecha. */
export function olderThan(
  iso: string,
  ms: number,
  now: Date = new Date()
): boolean {
  return now.getTime() - parseISO(iso).getTime() > ms
}

/** Días enteros hasta la fecha (negativo si ya pasó). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.ceil((parseISO(iso).getTime() - now.getTime()) / 86_400_000)
}

/** "148 MB" o "184,2 GB". */
export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return "—"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const digits = i >= 3 ? 1 : 0
  return `${v.toLocaleString("es", { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${units[i]}`
}

/** "+20", "−20" o "0" (con signo menos tipográfico). */
export function signed(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `−${Math.abs(n)}`
  return "0"
}

/** Compara versiones "2.5.0" número por número. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((x) => parseInt(x, 10) || 0)
  const pb = b.split(".").map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/** La versión más alta entre los servidores: la API no expone cuál es la última. */
export function latestVersion(
  versions: (string | null | undefined)[]
): string | null {
  return versions.reduce<string | null>(
    (best, v) => (v && (!best || compareVersions(v, best) > 0) ? v : best),
    null
  )
}

export type Tone =
  "neutral" | "warn" | "danger" | "primary" | "win" | "strong" | "vip"

/** Licencia de un servidor (contrato: `expiring` vence en 7 días o menos). */
export function licenseLabel(
  state: "ok" | "expiring" | "expired" | "revoked",
  expiresAt: string | null,
  now: Date = new Date()
): { text: string; tone: Tone } {
  switch (state) {
    case "revoked":
      return { text: "Revocado", tone: "danger" }
    case "expired":
      return {
        text: expiresAt ? `Venció el ${fmtDate(expiresAt)}` : "Vencida",
        tone: "danger",
      }
    case "expiring": {
      const d = expiresAt ? daysUntil(expiresAt, now) : 0
      return {
        text: d <= 1 ? "Vence mañana" : `Vence en ${d} días`,
        tone: "warn",
      }
    }
    case "ok":
      return {
        text: expiresAt ? `Hasta el ${fmtDate(expiresAt)}` : "Sin vencimiento",
        tone: "neutral",
      }
  }
}

/** Fecha ISO (AAAA-MM-DD) de hoy más `days`, para los campos de fecha. */
export function isoDatePlus(days: number, now: Date = new Date()): string {
  const d = new Date(now.getTime())
  d.setDate(d.getDate() + days)
  return format(d, "yyyy-MM-dd")
}

/** Fin del día local de una fecha AAAA-MM-DD, en ISO, para los vencimientos. */
export function endOfDayIso(date: string): string {
  return new Date(`${date}T23:59:59`).toISOString()
}
