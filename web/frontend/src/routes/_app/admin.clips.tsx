import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { AdminClipsPage } from "@/features/admin/clips/pages/AdminClipsPage"
import { CLIP_TABS } from "@/features/admin/clips/lib/clips"

export const Route = createFileRoute("/_app/admin/clips")({
  validateSearch: z.object({
    tab: z.enum(CLIP_TABS).optional().catch(undefined),
  }),
  component: AdminClipsPageRoute,
})

function AdminClipsPageRoute() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminClipsPage
      tab={tab ?? "list"}
      onTab={(t) =>
        void navigate({
          search: { tab: t === "list" ? undefined : t },
          resetScroll: false,
        })
      }
    />
  )
}
