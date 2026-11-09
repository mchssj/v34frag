import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"

import { notificationKeys } from "@/features/shell/notifications/api/queries"
import {
  NotificationsSourceContext,
  type NotificationsSource,
} from "@/features/shell/notifications/api/source"
import { NotificationsMenu } from "@/features/shell/notifications/components/NotificationsMenu"
import type { Notification } from "@/features/shell/notifications/lib/model"
import type { PcwNotice } from "../types"

const TYPE: Record<PcwNotice["kind"], string> = {
  offer: "pcw_offer",
  chosen: "pcw_offer_chosen",
  rejected: "pcw_offer_rejected",
  soon: "pcw_soon",
}

/** Un aviso de la demo con la forma de una notificación de la API. */
function toNotification(n: PcwNotice, id: number): Notification {
  return {
    id,
    type: TYPE[n.kind],
    category: "pcw",
    data: {
      team: n.team ? { name: n.team } : undefined,
      minutes: n.minutes,
      match_id: n.match_id,
    },
    actionable: false,
    resolution: null,
    actor: null,
    created_at: n.at,
    read: n.read,
  } as Notification
}

/**
 * La campana de notificaciones de la web (la misma de la barra de arriba) con los avisos de la demo de PCW: así se
 * ven como en la web real (Kyan, 2026-11-08). Caché aparte para no mezclarse con las notificaciones reales.
 */
export function DemoNotifications({
  notices,
  onRead,
}: {
  notices: PcwNotice[]
  onRead: (ids?: string[]) => void
}) {
  const [queryClient] = useState(() => new QueryClient())
  // Las notificaciones reales tienen id numérico: el orden de llegada en la demo.
  const latest = useRef(notices)
  useEffect(() => {
    latest.current = notices
    void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
  }, [notices, queryClient])
  const [source] = useState<NotificationsSource>(() => {
    const items = () =>
      latest.current.map((n, i, all) => toNotification(n, all.length - i))
    return {
      async unread() {
        return {
          unread: latest.current.filter((n) => !n.read).length,
          actionable: 0,
        }
      },
      async list() {
        return items()
      },
      async markRead(ids) {
        if (ids === "all") return onRead()
        const all = latest.current
        onRead(ids.map((id) => all[all.length - id]!.id))
      },
    }
  })

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationsSourceContext value={source}>
        <NotificationsMenu />
      </NotificationsSourceContext>
    </QueryClientProvider>
  )
}
