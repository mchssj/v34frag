import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/match/$id")({
  component: MatchPage,
})

function MatchPage() {
  const { id } = Route.useParams()
  return <Placeholder title={`Partida ${id}`} />
}
