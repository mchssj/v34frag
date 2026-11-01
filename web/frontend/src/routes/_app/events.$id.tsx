import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { EventView } from "@/features/events/pages/EventView"

// ?tab: la pestaña (sin él, Resumen). ?phase: la fase de la Llave (sin él, la que está en curso).
const searchSchema = z.object({
  tab: z.enum(["bracket", "standings", "matches"]).optional().catch(undefined),
  phase: z.string().max(20).optional().catch(undefined),
})

export const Route = createFileRoute("/_app/events/$id")({
  validateSearch: searchSchema,
  component: EventPage,
})

function EventPage() {
  const { id } = Route.useParams()
  const { tab, phase } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <EventView
      key={id}
      eventId={id}
      tab={tab}
      phase={phase}
      onPhase={(p) =>
        navigate({ search: (s) => ({ ...s, phase: p }), replace: true })
      }
    />
  )
}
