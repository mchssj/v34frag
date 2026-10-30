import { createFileRoute } from "@tanstack/react-router"

import { AdminRankingPage } from "@/features/admin/ranking/AdminRankingPage"

export const Route = createFileRoute("/_app/admin/ranking")({
  component: AdminRankingPage,
})
