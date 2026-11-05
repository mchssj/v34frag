import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { TeamView } from "@/features/teams/pages/TeamView"
import { teamDetailOptions } from "@/features/teams/api/queries"
import { usePageMeta } from "@/lib/seo"

export const Route = createFileRoute("/_app/teams/$id")({
  component: TeamPage,
})

/** Vista pública de un equipo: el mismo layout que Mi equipo, en solo lectura. */
function TeamPage() {
  const { id } = Route.useParams()
  // La misma consulta que usa TeamView: sale de la caché.
  const name = useQuery(teamDetailOptions(id)).data?.name
  usePageMeta({
    title: name ?? "Equipo",
    description: name
      ? `${name} en CM League: plantel, resultados y torneos de Counter-Strike: Source.`
      : undefined,
  })
  return <TeamView key={id} teamId={id} mode="public" />
}
