import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/matches/")({
  component: MatchesPage,
})

function MatchesPage() {
  return <Placeholder title="Partidas" />
}
