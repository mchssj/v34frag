import { createFileRoute } from "@tanstack/react-router"

import { MatchesList } from "@/features/matches/pages/MatchesList"
import { matchesSearchSchema } from "@/features/matches/lib/search"
import { usePageMeta } from "@/lib/seo"

export const Route = createFileRoute("/_app/matches/")({
  validateSearch: matchesSearchSchema,
  component: MatchesPage,
})

function MatchesPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  usePageMeta({
    title: "Partidas",
    description:
      "Partidas de CM League en vivo y terminadas: mixes, PCW y torneos de Counter-Strike: Source con resultados y estadísticas.",
  })
  return (
    <MatchesList
      search={search}
      onChange={(patch) =>
        void navigate({
          search: (prev) => ({ ...prev, ...patch }),
          replace: true,
          // Misma página: cambiar de filtro no mueve el scroll.
          resetScroll: false,
        })
      }
    />
  )
}
