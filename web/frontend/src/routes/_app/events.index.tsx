import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/events/")({
  component: EventsPage,
})

function EventsPage() {
  return <Placeholder title="Torneos" />
}
