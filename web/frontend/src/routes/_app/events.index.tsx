import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import { EventList } from "@/features/events/pages/EventList"

// ?status: el filtro del listado (sin él, Todos). ?order=asc: los más antiguos primero (sin él, los más recientes).
const searchSchema = z.object({
  status: z
    .enum(["registration", "in_progress", "finished"])
    .optional()
    .catch(undefined),
  order: z.enum(["asc", "desc"]).optional().catch(undefined),
})

export const Route = createFileRoute("/_app/events/")({
  validateSearch: searchSchema,
  component: EventsPage,
})

function EventsPage() {
  const { status, order } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  return (
    <EventList
      filter={status}
      onFilter={(f) =>
        void navigate({
          search: (prev) => ({ ...prev, status: f }),
          resetScroll: false,
        })
      }
      order={order ?? "desc"}
      onOrder={(o) =>
        void navigate({
          search: (prev) => ({
            ...prev,
            order: o === "desc" ? undefined : o,
          }),
          resetScroll: false,
        })
      }
    />
  )
}
