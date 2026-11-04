import type { Booking, BookingStatus, MatchBooking } from "../types/booking"

/** Estados en los que la reserva sigue abierta (se refresca y se muestra el panel). */
const OPEN: BookingStatus[] = [
  "ready",
  "veto",
  "queued",
  "assigned",
  "live",
  "between",
  "lost",
]

export const isOpen = (b: Booking | null | undefined): b is Booking =>
  !!b && OPEN.includes(b.status)

/** Segundos que faltan hasta `iso` (0 si ya pasó o no hay). */
export function secondsLeft(iso: string | null | undefined, now: number) {
  if (!iso) return 0
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000))
}

/** 5:07, 0:09. */
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** Minutos que todavía se pueden sumar a la espera de un torneo sin pasar de 20 desde que empezó. */
export function extendRoom(b: Booking, now: number) {
  if (!b.wait_started_at) return 0
  const cap = Date.parse(b.wait_started_at) + 20 * 60_000
  const base = Math.max(
    now,
    b.wait_deadline ? Date.parse(b.wait_deadline) : now
  )
  return Math.max(0, Math.floor((cap - base) / 60_000))
}

/** Por qué terminó la reserva, para quien mira la partida. `names`: los dos equipos. */
export function endedText(b: Booking, names: [string, string]) {
  if (b.status === "abandoned") {
    if (b.abandoned_side === 3)
      return "Ninguno de los dos equipos se presentó: la PCW se dio por abandonada y no cuenta para nadie."
    const who = names[(b.abandoned_side ?? 1) - 1]
    return `${who} no se presentó o abandonó: la PCW no cuenta para nadie y ${who} queda sancionado.`
  }
  if (b.status !== "cancelled") return null
  switch (b.end_reason) {
    case "ready_removed":
      return "Un equipo dejó de estar listo antes de tener servidor."
    case "server_lost":
      return "El servidor dejó de responder y se liberó. El organizador puede iniciarla de nuevo en otro."
    case "timeout":
      return "La reserva pasó el tiempo máximo y se liberó el servidor."
    case "admin":
      return "Se canceló la reserva del servidor."
    default:
      return b.end_reason?.startsWith("server:")
        ? `El servidor no pudo tomar la partida (${b.end_reason.slice(7).trim()}).`
        : null
  }
}

/** Resumen de una línea del estado de la reserva abierta. */
export function statusLine(mb: MatchBooking, names: [string, string]) {
  const b = mb.booking
  if (!isOpen(b)) return null
  const server = b.server?.name ?? "el servidor"
  switch (b.status) {
    case "ready": {
      const waiting = b.ready1 ? names[1] : names[0]
      return `Falta que ${waiting} se marque listo.`
    }
    case "veto":
      return mb.kind === "official"
        ? `${server} está reservado: primero termina el veto.`
        : "Los dos equipos están listos: primero termina el veto."
    case "queued":
      return b.queue_position
        ? `Esperando un servidor libre: puesto ${b.queue_position} en la fila.`
        : "Esperando un servidor libre."
    case "assigned":
      return b.taken
        ? `${server} cargó el mapa ${b.map_no}: ¡a conectarse!`
        : `${server} está tomando la partida…`
    case "live":
      return `Mapa ${b.map_no} en juego en ${server}.`
    case "between":
      return `Terminó un mapa: el siguiente carga en ${server} en un minuto y medio.`
    case "lost":
      return `${server} no responde. Si no vuelve en 10 minutos, se libera.`
  }
  return null
}
