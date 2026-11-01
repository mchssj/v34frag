import { createFileRoute } from "@tanstack/react-router"

import {
  AdminEventsPage,
  adminEventsSearch,
} from "@/features/admin/events/pages/AdminEventsPage"

export const Route = createFileRoute("/_app/admin/events/")({
  validateSearch: adminEventsSearch,
  component: AdminEventsRoute,
})

function AdminEventsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminEventsPage
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
