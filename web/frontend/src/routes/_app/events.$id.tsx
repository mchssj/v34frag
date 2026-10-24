import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/events/$id")({
  component: EventPage,
})

function EventPage() {
  const { id } = Route.useParams()
  return <Placeholder title={`Torneo ${id}`} />
}
