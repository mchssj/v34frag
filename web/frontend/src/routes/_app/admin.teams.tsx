import { createFileRoute } from "@tanstack/react-router"

import { AdminTeamsPage } from "@/features/admin/teams/pages/AdminTeamsPage"

export const Route = createFileRoute("/_app/admin/teams")({
  component: AdminTeamsPage,
})
