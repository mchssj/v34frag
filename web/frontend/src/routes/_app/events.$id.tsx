import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { EventView } from "@/features/events/pages/EventView"
import { eventDetailOptions } from "@/features/events/api/queries"
import { usePageMeta } from "@/lib/seo"

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
  // La misma consulta que usa EventView: sale de la caché.
  const name = useQuery(eventDetailOptions(id)).data?.name
  usePageMeta({
    title: name ?? "Torneo",
    description: name
      ? `${name}: llave, posiciones, partidas e inscritos del torneo de CM League.`
      : undefined,
  })
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
