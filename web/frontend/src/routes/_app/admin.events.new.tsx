import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { AdminEventNewPage } from "@/features/admin/events/pages/AdminEventPages"

export const Route = createFileRoute("/_app/admin/events/new")({
  validateSearch: z.object({
    historic: z.boolean().optional().catch(undefined),
  }),
  component: AdminEventNewRoute,
})

function AdminEventNewRoute() {
  const { historic } = Route.useSearch()
  return <AdminEventNewPage historic={!!historic} />
}
