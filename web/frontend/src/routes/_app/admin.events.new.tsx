import { createFileRoute } from "@tanstack/react-router"

import { AdminEventNewPage } from "@/features/admin/events/pages/AdminEventPages"

export const Route = createFileRoute("/_app/admin/events/new")({
  component: AdminEventNewPage,
})
