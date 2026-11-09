import { createContext, useContext } from "react"

import type { Schemas } from "@/api/client"
import type { Notification } from "../lib/model"

/**
 * De dónde salen las notificaciones de la campana. Sin proveedor, de la API (lo de siempre). Una demo puede darle
 * las suyas (la de PCW: bitácora 2026-11-08-pcw-demo) y la campana se ve y funciona igual.
 */
export type NotificationsSource = {
  unread(signal?: AbortSignal): Promise<Schemas["UnreadCount"]>
  list(signal?: AbortSignal): Promise<Notification[]>
  markRead(ids: number[] | "all"): Promise<unknown>
}

export const NotificationsSourceContext =
  createContext<NotificationsSource | null>(null)

export const useNotificationsSource = () =>
  useContext(NotificationsSourceContext)
