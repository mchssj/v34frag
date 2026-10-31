import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/components/Placeholder"

export const Route = createFileRoute("/_app/admin/teams")({
  component: AdminTeamsPage,
})

function AdminTeamsPage() {
  return <Placeholder title="Equipos" />
}
