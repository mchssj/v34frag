import { createFileRoute } from "@tanstack/react-router"

import { TeamsRanking } from "@/features/ranking/pages/TeamsRanking"
import { teamRankingSearchSchema } from "@/features/ranking/lib/search"

export const Route = createFileRoute("/_app/ranking/teams")({
  validateSearch: teamRankingSearchSchema,
  component: TeamRankingPage,
})

function TeamRankingPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
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
