import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  AdminMedalsPage,
  MEDAL_TABS,
} from "@/features/admin/medals/pages/AdminMedalsPage"

export const Route = createFileRoute("/_app/admin/medals")({
  validateSearch: z.object({
    tab: z.enum(MEDAL_TABS).optional().catch(undefined),
  }),
  component: AdminMedalsPageRoute,
})

function AdminMedalsPageRoute() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminMedalsPage
      tab={tab ?? "give"}
      onTab={(t) =>
        void navigate({
          search: { tab: t === "give" ? undefined : t },
          resetScroll: false,
        })
      }
    />
  )
}
