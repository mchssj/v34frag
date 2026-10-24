import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/ranking/teams")({
  component: TeamRankingPage,
})

function TeamRankingPage() {
  return <Placeholder title="Ranking de equipos" />
}
