import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  AdminServersPage,
  SERVER_TABS,
} from "@/features/admin/servers/AdminServersPage"

export const Route = createFileRoute("/_app/admin/servers")({
  validateSearch: z.object({
    tab: z.enum(SERVER_TABS).optional().catch(undefined),
  }),
  component: AdminServersRoute,
})

function AdminServersRoute() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminServersPage
      tab={tab ?? "servers"}
      onTab={(t) =>
        void navigate({ search: { tab: t === "servers" ? undefined : t } })
      }
    />
  )
}
