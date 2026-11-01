import { createFileRoute } from "@tanstack/react-router"

import {
  AdminEventPage,
  adminEventSearch,
} from "@/features/admin/events/pages/AdminEventPages"

export const Route = createFileRoute("/_app/admin/events/$id")({
  validateSearch: adminEventSearch,
  component: AdminEventRoute,
})

function AdminEventRoute() {
  const { id } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminEventPage
      id={id}
      tab={tab}
      onTab={(t) => void navigate({ search: { tab: t }, resetScroll: false })}
    />
  )
}
