import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  AdminPlayersPage,
  PLAYER_TABS,
} from "@/features/admin/players/AdminPlayersPage"

export const Route = createFileRoute("/_app/admin/players")({
  validateSearch: z.object({
    tab: z.enum(PLAYER_TABS).optional().catch(undefined),
  }),
  component: AdminPlayersRoute,
})

function AdminPlayersRoute() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminPlayersPage
      tab={tab ?? "fichas"}
      onTab={(t) =>
        void navigate({
          search: { tab: t === "fichas" ? undefined : t },
          resetScroll: false,
        })
      }
    />
  )
}
