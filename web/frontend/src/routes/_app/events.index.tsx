import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import { EventList } from "@/features/events/EventList"

// ?status: el filtro del listado (sin él, Todos).
const searchSchema = z.object({
  status: z
    .enum(["registration", "in_progress", "finished"])
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute("/_app/events/")({
  validateSearch: searchSchema,
  component: EventsPage,
})

function EventsPage() {
  const { status } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  return (
    <EventList
      filter={status}
      onFilter={(f) =>
        void navigate({ search: { status: f }, resetScroll: false })
      }
    />
  )
}
