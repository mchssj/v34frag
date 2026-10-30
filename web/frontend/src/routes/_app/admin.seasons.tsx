import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  AdminSeasonsPage,
  SEASON_TABS,
} from "@/features/admin/seasons/AdminSeasonsPage"

export const Route = createFileRoute("/_app/admin/seasons")({
  validateSearch: z.object({
    tab: z.enum(SEASON_TABS).optional().catch(undefined),
  }),
  component: AdminSeasonsPageRoute,
})

function AdminSeasonsPageRoute() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminSeasonsPage
      tab={tab ?? "active"}
      onTab={(t) =>
        void navigate({ search: { tab: t === "active" ? undefined : t } })
      }
    />
  )
}
