import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/player/$nick")({
  component: PlayerPage,
})

function PlayerPage() {
  const { nick } = Route.useParams()
  return <Placeholder title={nick} />
}
