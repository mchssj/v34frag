import { createFileRoute } from "@tanstack/react-router"

import { TeamView } from "@/features/teams/TeamView"

export const Route = createFileRoute("/_app/teams/$id")({
  component: TeamPage,
})

/** Vista pública de un equipo: el mismo layout que Mi equipo, en solo lectura. */
function TeamPage() {
  const { id } = Route.useParams()
  return <TeamView key={id} teamId={id} mode="public" />
}
