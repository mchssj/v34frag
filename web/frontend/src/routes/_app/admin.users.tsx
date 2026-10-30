import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  AdminUsersPage,
  USER_TABS,
} from "@/features/admin/users/AdminUsersPage"

export const Route = createFileRoute("/_app/admin/users")({
  validateSearch: z.object({
    tab: z.enum(USER_TABS).optional().catch(undefined),
  }),
  component: AdminUsersRoute,
})

function AdminUsersRoute() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminUsersPage
      tab={tab ?? "accounts"}
      onTab={(t) =>
        void navigate({ search: { tab: t === "accounts" ? undefined : t } })
      }
    />
  )
}
