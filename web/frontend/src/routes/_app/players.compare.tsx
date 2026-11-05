import { createFileRoute } from "@tanstack/react-router"

import { Compare } from "@/features/ranking/pages/Compare"
import { compareSearchSchema } from "@/features/ranking/lib/search"
import { usePageMeta } from "@/lib/seo"

export const Route = createFileRoute("/_app/players/compare")({
  validateSearch: compareSearchSchema,
  component: ComparePage,
})

function ComparePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  usePageMeta({
    title: "Comparar jugadores",
    description:
      "Compara a dos jugadores de CM League: ELO, nivel y estadísticas en Counter-Strike: Source.",
  })
  return (
    <Compare
      search={search}
      onChange={(next) =>
        void navigate({ search: next, replace: true, resetScroll: false })
      }
    />
  )
}
