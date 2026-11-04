import { format, parseISO, subDays } from "date-fns"
import { es } from "date-fns/locale"

import { LEVEL_FLOORS } from "@/features/player/lib/labels"
import {
  isPending,
  type Notification,
} from "@/features/shell/notifications/lib/model"

// Cálculos de "Para ti" (/home): saludo, cambio de ELO de la semana, avance de nivel y orden de
// los pendientes.

/** "Buenos días" hasta las 12, "Buenas tardes" hasta las 20 y "Buenas noches" después. */
export function greeting(now: Date) {
  const h = now.getHours()
  return h >= 5 && h < 12
    ? "Buenos días"
    : h >= 12 && h < 20
      ? "Buenas tardes"
      : "Buenas noches"
}

/** "Lunes 3 de noviembre". */
export function dateLabel(now: Date) {
  const s = format(now, "EEEE d 'de' MMMM", { locale: es })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Suma de los cambios de ELO de los últimos 7 días (el historial no filtra por fecha). */
export function weekDelta(
  points: { at: string | null; elo_delta: number | null }[],
  now: Date
) {
  const from = subDays(now, 7)
  return points
    .filter((p) => p.at && parseISO(p.at) >= from)
    .reduce((sum, p) => sum + (p.elo_delta ?? 0), 0)
}

/** Avance dentro del nivel: porcentaje y ELO que falta para el siguiente (null en el 10). */
export function levelProgress(level: number, elo: number) {
  if (level >= 10) return { pct: 100, toNext: null }
  const floor = LEVEL_FLOORS[level - 1] ?? 0
  const next = LEVEL_FLOORS[level]
  const pct = Math.round(((elo - floor) / (next - floor)) * 100)
  return { pct: Math.max(0, Math.min(100, pct)), toNext: next - elo }
}

/** % de victorias, o null sin partidas. */
export function winRate(wins: number | null, losses: number | null) {
  const n = (wins ?? 0) + (losses ?? 0)
  return n ? Math.round(((wins ?? 0) / n) * 100) : null
}

// Avisos que piden ir a algún lado ya: van antes que las respuestas pendientes.
const NOW_TYPES = new Set([
  "veto_turn",
  "match_server_ready",
  "pcw_server_ready",
  "booking_attention",
])

/**
 * Urgencia de una notificación para Pendientes: 1 = turno o servidor listo, 3 = espera una
 * respuesta, 4 = aviso sin leer. null = no va (leída y sin nada que hacer). El 0 y el 2 son del
 * matchmaking (sala para aceptar e invitación a un grupo).
 */
export function notificationRank(n: Notification): number | null {
  if (NOW_TYPES.has(n.type) && !n.read) return 1
  if (isPending(n)) return 3
  if (!n.read) return 4
  return null
}

/** Las notificaciones que van en Pendientes, por urgencia y, dentro de cada una, la más nueva. */
export function pendingNotifications(items: Notification[]) {
  return items
    .map((n) => ({ n, rank: notificationRank(n) }))
    .filter((x): x is { n: Notification; rank: number } => x.rank !== null)
    .sort(
      (a, b) => a.rank - b.rank || b.n.created_at.localeCompare(a.n.created_at)
    )
}
