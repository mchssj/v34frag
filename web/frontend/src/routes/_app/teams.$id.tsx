import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/teams/$id")({
  component: TeamPage,
})

function TeamPage() {
  const { id } = Route.useParams()
  return <Placeholder title={`Equipo ${id}`} />
}
