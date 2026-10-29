import { createFileRoute } from "@tanstack/react-router"

import {
  AdminBansPage,
  banSearchSchema,
} from "@/features/admin/bans/AdminBansPage"

export const Route = createFileRoute("/_app/admin/bans")({
  validateSearch: banSearchSchema,
  component: AdminBansRoute,
})

function AdminBansRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminBansPage
      search={search}
      onSearch={(patch) =>
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }
    />
  )
}
