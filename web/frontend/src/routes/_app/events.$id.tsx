import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { EventView } from "@/features/events/EventView"

// ?tab: la pestaña (sin él, Resumen).
const searchSchema = z.object({
  tab: z.enum(["bracket", "standings", "matches"]).optional().catch(undefined),
})

export const Route = createFileRoute("/_app/events/$id")({
  validateSearch: searchSchema,
  component: EventPage,
})

function EventPage() {
  const { id } = Route.useParams()
  const { tab } = Route.useSearch()
  return <EventView key={id} eventId={id} tab={tab} />
}
