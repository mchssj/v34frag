import { createFileRoute } from "@tanstack/react-router"

import { MixMatchRoom } from "@/features/mixes/MixRoomPages"

export const Route = createFileRoute("/_app/match/$id")({
  component: MatchPage,
})

// Por ahora solo los mixes tienen sala; torneos y PCW siguen con el placeholder.
function MatchPage() {
  const { id } = Route.useParams()
  return <MixMatchRoom id={id} />
}
