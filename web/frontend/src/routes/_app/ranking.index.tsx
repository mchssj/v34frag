import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/ranking/")({
  component: RankingPage,
})

function RankingPage() {
  return <Placeholder title="Ranking" />
}
