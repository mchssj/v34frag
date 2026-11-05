import { createFileRoute } from "@tanstack/react-router"

import { PlayersRanking } from "@/features/ranking/pages/PlayersRanking"
import { playerRankingSearchSchema } from "@/features/ranking/lib/search"
import { usePageMeta } from "@/lib/seo"

export const Route = createFileRoute("/_app/ranking/")({
  validateSearch: playerRankingSearchSchema,
  component: RankingPage,
})

function RankingPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  usePageMeta({
    title: "Ranking de jugadores",
    description:
      "Ranking de jugadores de CM League por ELO: nivel, partidas, K/D y temporada en Counter-Strike: Source v34.",
  })
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
