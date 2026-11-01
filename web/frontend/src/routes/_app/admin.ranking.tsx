import { createFileRoute } from "@tanstack/react-router"

import { AdminRankingPage } from "@/features/admin/ranking/pages/AdminRankingPage"

export const Route = createFileRoute("/_app/admin/ranking")({
  component: AdminRankingPage,
})
