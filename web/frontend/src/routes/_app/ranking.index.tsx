import { createFileRoute } from "@tanstack/react-router"

import { PlayersRanking } from "@/features/ranking/PlayersRanking"
import { playerRankingSearchSchema } from "@/features/ranking/search"

export const Route = createFileRoute("/_app/ranking/")({
  validateSearch: playerRankingSearchSchema,
  component: RankingPage,
})

function RankingPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <PlayersRanking
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
