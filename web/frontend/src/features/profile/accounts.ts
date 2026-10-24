import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

import type { Schemas } from "@/api/client"
import type { SteamStatus } from "@/features/onboarding/queries"

// Mi perfil → Vinculación: los SteamID de la cuenta y las solicitudes de SteamID adicional.

export type SteamRequest = Schemas["MySteamRequest"]

export type GameAccountRow =
  | {
      kind: "linked"
      steamId: string
      primary: boolean
      /** "Vinculada ago 2026" o "Fecha desconocida" (vinculado antes de que se guardara). */
      since: string
      /** Tiene un pedido para desvincularlo esperando a un admin. */
      unlinkPending: boolean
      /** El único SteamID de la ficha no se puede desvincular. */
      canUnlink: boolean
    }
  | {
      kind: "pending"
      steamId: string
      nick: string | null
      requestedAt: string
    }

export type GameAccounts = {
  rows: GameAccountRow[]
  linked: number
  max: number
  /** Vinculadas más pendientes llegan al tope: no se ofrece enlazar otra. */
  atLimit: boolean
  empty: boolean
  addTitle: string
}

export function gameAccounts(
  status: SteamStatus,
  pending: SteamRequest[]
): GameAccounts {
  // La API ya manda la principal primero; se ordena igual por si cambia.
  const linked = [...status.steam_ids].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary)
  )
  const rows: GameAccountRow[] = [
    ...linked.map((s) => ({
      kind: "linked" as const,
      steamId: s.steam_id,
      primary: s.is_primary,
      since: s.added_at
        ? `Vinculada ${format(parseISO(s.added_at), "MMM yyyy", { locale: es })}`
        : "Fecha desconocida",
      unlinkPending: s.unlink_pending,
      canUnlink: linked.length > 1,
    })),
    ...pending.map((r) => ({
      kind: "pending" as const,
      steamId: r.steam_id,
      nick: r.nick,
      requestedAt: r.created_at,
    })),
  ]
  const empty = rows.length === 0
  return {
    rows,
    linked: linked.length,
    max: status.max_steam_ids,
    atLimit: rows.length >= status.max_steam_ids,
    empty,
    addTitle: empty
      ? "Vincula tu primera cuenta desde el juego"
      : "¿Quieres enlazar otro SteamID?",
  }
}

export type ClaimToast = {
  tone: "success" | "info" | "error"
  title: string
  /** El mensaje que vio el jugador en el chat del servidor. */
  description: string | null
}

/**
 * Qué pasó con el código que se estaba esperando, o null si sigue igual. El backend marca el
 * código como usado también cuando el `!claim` falla (otra cuenta, tope…): se decide por dónde
 * quedó el SteamID, no por el texto.
 */
export function claimOutcome(
  waitingFor: string,
  status: SteamStatus,
  pending: SteamRequest[]
): ClaimToast | null {
  const last = status.last_code
  if (!last || last.code !== waitingFor || last.status !== "used") return null
  const id = last.used_steam_id
  if (id && status.steam_ids.some((s) => s.steam_id === id))
    return {
      tone: "success",
      title: `Cuenta ${id} vinculada`,
      description: null,
    }
  if (id && pending.some((r) => r.steam_id === id))
    return {
      tone: "info",
      title: `Pedido enviado: un admin tiene que aprobar ${id}`,
      description: last.result,
    }
  return {
    tone: "error",
    title: last.result ?? "No se pudo vincular la cuenta.",
    description: null,
  }
}
