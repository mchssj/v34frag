import { createFileRoute } from "@tanstack/react-router"

import { MixesList } from "@/features/mixes/MixesList"
import { mixesSearchSchema } from "@/features/mixes/search"

export const Route = createFileRoute("/_app/mixes/")({
  validateSearch: mixesSearchSchema,
  component: MixesPage,
})

function MixesPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <MixesList
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
