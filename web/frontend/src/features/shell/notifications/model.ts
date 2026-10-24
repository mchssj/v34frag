import { formatDistanceStrict, isSameDay, parseISO, subDays } from "date-fns"
import { es } from "date-fns/locale"
import { useState } from "react"

import type { AppPath } from "../nav"
import { mockNotifications } from "./mock"

// TODO backend: el endpoint de notificaciones no existe. Mientras tanto, datos de ejemplo solo en
// desarrollo y pruebas; en producción la lista queda vacía ("Estás al día.").

export type NotificationKind =
  "invite" | "pcw" | "veto" | "roster" | "medal" | "team" | "elo"

export type Notification = {
  id: string
  kind: NotificationKind
  title: string
  body: string
  createdAt: string
  read: boolean
  path?: AppPath
  resolution?: "accepted" | "rejected"
  /** Datos de la invitación para el diálogo de detalle. */
  invite?: { team: string; from: string; message?: string }
}

export type NotificationTab = "all" | "unread" | "requests"

/** Se pueden aceptar o rechazar desde la lista. */
export const isActionable = (n: Notification) =>
  n.kind === "invite" || n.kind === "pcw"
/** Se destacan con el color primario. */
export const isUrgent = (n: Notification) =>
  n.kind === "invite" || n.kind === "pcw" || n.kind === "veto"
// PCW y veto son cosas de capitán (o admin).
const CAPTAIN_ONLY: NotificationKind[] = ["pcw", "veto"]

export function filterByTab(items: Notification[], tab: NotificationTab) {
  if (tab === "unread") return items.filter((n) => !n.read)
  if (tab === "requests") return items.filter(isActionable)
  return items
}

/** "hace 5 minutos", "hace 3 horas", "ayer", "hace 4 días". */
export function timeAgo(iso: string, now = new Date()) {
  const date = parseISO(iso)
  if (isSameDay(date, subDays(now, 1))) return "ayer"
  return formatDistanceStrict(date, now, { addSuffix: true, locale: es })
}

export function useNotifications({ captain }: { captain: boolean }) {
  const [items, setItems] = useState<Notification[]>(() =>
    import.meta.env.DEV ? mockNotifications() : []
  )
  const visible = items.filter((n) => captain || !CAPTAIN_ONLY.includes(n.kind))
  const update = (id: string, patch: Partial<Notification>) =>
    setItems((all) => all.map((n) => (n.id === id ? { ...n, ...patch } : n)))

  return {
    items: visible,
    unread: visible.filter((n) => !n.read).length,
    markRead: (id: string) => update(id, { read: true }),
    markAllRead: () =>
      setItems((all) => all.map((n) => ({ ...n, read: true }))),
    resolve: (id: string, resolution: "accepted" | "rejected") =>
      update(id, { resolution, read: true }),
  }
}
