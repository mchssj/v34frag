import { createFileRoute } from "@tanstack/react-router"

import { Compare } from "@/features/ranking/Compare"
import { compareSearchSchema } from "@/features/ranking/search"

export const Route = createFileRoute("/_app/players/compare")({
  validateSearch: compareSearchSchema,
  component: ComparePage,
})

function ComparePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <Compare
      search={search}
      onChange={(next) => void navigate({ search: next, replace: true })}
    />
  )
}
