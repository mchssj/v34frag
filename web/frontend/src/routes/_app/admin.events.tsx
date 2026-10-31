import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/components/Placeholder"

export const Route = createFileRoute("/_app/admin/events")({
  component: AdminEventsPage,
})

function AdminEventsPage() {
  return <Placeholder title="Torneos y resultados" />
}
