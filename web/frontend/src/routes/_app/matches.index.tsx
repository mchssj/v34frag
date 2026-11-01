import { createFileRoute } from "@tanstack/react-router"

import { MatchesList } from "@/features/matches/MatchesList"
import { matchesSearchSchema } from "@/features/matches/search"

export const Route = createFileRoute("/_app/matches/")({
  validateSearch: matchesSearchSchema,
  component: MatchesPage,
})

function MatchesPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
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
