import { createFileRoute } from "@tanstack/react-router"

import { TeamsRanking } from "@/features/ranking/pages/TeamsRanking"
import { teamRankingSearchSchema } from "@/features/ranking/lib/search"
import { usePageMeta } from "@/lib/seo"

export const Route = createFileRoute("/_app/ranking/teams")({
  validateSearch: teamRankingSearchSchema,
  component: TeamRankingPage,
})

function TeamRankingPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  usePageMeta({
    title: "Ranking de equipos",
    description:
      "Ranking de equipos de CM League: puntos, partidas y resultados en torneos y PCW de Counter-Strike: Source.",
  })
  return (
    <TeamsRanking
      search={search}
      onChange={(patch) =>
        void navigate({
          search: (prev) => ({ ...prev, ...patch }),
          replace: true,
          // Es estado de la misma vista: no se vuelve arriba.
          resetScroll: false,
        })
      }
    />
  )
}
