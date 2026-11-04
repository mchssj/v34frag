import { createFileRoute } from "@tanstack/react-router"

import {
  AdminTeamsPage,
  adminTeamsSearch,
} from "@/features/admin/teams/pages/AdminTeamsPage"

export const Route = createFileRoute("/_app/admin/teams")({
  validateSearch: adminTeamsSearch,
  component: AdminTeamsRoute,
})

function AdminTeamsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminTeamsPage
      search={search}
      onSearch={(patch) =>
        void navigate({
          search: (prev) => ({ ...prev, ...patch }),
          resetScroll: false,
        })
      }
    />
  )
}
