import { createFileRoute } from "@tanstack/react-router"

import { TeamsRanking } from "@/features/ranking/TeamsRanking"
import { teamRankingSearchSchema } from "@/features/ranking/search"

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
        })
      }
    />
  )
}
