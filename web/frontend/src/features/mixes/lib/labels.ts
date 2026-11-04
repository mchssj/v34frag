import { format, formatDistanceToNow, parseISO } from "date-fns"
import { es } from "date-fns/locale"

// Textos y cálculos de presentación de Mixes (handoff_mixes y contrato 8d).

export type DemoTone = "up" | "pending" | "off"

/** Estado de la demo en el listado: punto de color y texto. */
export function demoStatus(status: string): { label: string; tone: DemoTone } {
  switch (status) {
    case "uploaded":
      return { label: "Disponible", tone: "up" }
    case "pending":
      return { label: "Subiendo", tone: "pending" }
    case "expired":
      return { label: "Vencida", tone: "off" }
    case "missing":
      return { label: "No encontrada", tone: "off" }
    default:
      return { label: "—", tone: "off" }
  }
}

// Los motivos que manda la API como código; cualquier otro se muestra tal cual (texto libre).
const CANCEL_REASONS: Record<string, string> = {
  abandoned: "Abandono",
  map_change: "Cambio de mapa",
  admin: "Admin",
  crash: "Interrumpida",
}

export function cancelReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Sin motivo"
  return CANCEL_REASONS[reason] ?? reason
}

/** Alias si tiene ficha; si no, el nombre del juego. */
export function nickOf(p: {
  alias: string | null
  game_nick: string | null
}): string {
  return p.alias ?? p.game_nick ?? "Jugador"
}

/** % de kills con headshot, redondeado (null sin kills). */
export function hsPercent(
  headshots: number | null,
  kills: number | null
): number | null {
  if (!kills || headshots == null) return null
  return Math.round((headshots / kills) * 100)
}

/** Daño promedio por ronda, redondeado (null sin rondas). */
export function adr(
  damage: number | null,
  rounds: number | null
): number | null {
  if (!rounds || damage == null) return null
  return Math.round(damage / rounds)
}

/** "+5", "-3" o "0". */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

/** Tamaño de la demo en MB (bytes de la API), sin decimales y como mínimo 1. */
export function demoMb(bytes: number): number {
  return Math.max(1, Math.round(bytes / 1_048_576))
}

export type Tv = { host: string; port: number }

export const tvAddress = (tv: Tv) => `${tv.host}:${tv.port}`
export const tvUrl = (tv: Tv) => `steam://connect/${tvAddress(tv)}`

const parse = (iso: string) => parseISO(iso)

/** "24 oct" */
export const fmtDay = (iso: string) =>
  format(parse(iso), "dd MMM", { locale: es }).replace(".", "")

/** "21:30" */
export const fmtTime = (iso: string) => format(parse(iso), "HH:mm")

/** "hace 24 minutos" */
export const fmtAgo = (iso: string) =>
  formatDistanceToNow(parse(iso), { locale: es, addSuffix: true })
