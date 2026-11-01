import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  AdminClipsPage,
  CLIP_TABS,
} from "@/features/admin/clips/AdminClipsPage"

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
      tab={tab ?? "review"}
      onTab={(t) =>
        void navigate({
          search: { tab: t === "review" ? undefined : t },
          resetScroll: false,
        })
      }
    />
  )
}
