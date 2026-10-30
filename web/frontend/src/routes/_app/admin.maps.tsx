import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { AdminMapsPage, MAP_FILTERS } from "@/features/admin/maps/AdminMapsPage"

export const Route = createFileRoute("/_app/admin/maps")({
  validateSearch: z.object({
    filter: z.enum(MAP_FILTERS).optional().catch(undefined),
    map: z.string().max(40).optional().catch(undefined),
  }),
  component: AdminMapsRoute,
})

function AdminMapsRoute() {
  const { filter, map } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminMapsPage
      filter={filter}
      selected={map}
      onFilter={(f) =>
        void navigate({
          search: (prev) => ({ ...prev, filter: f }),
          resetScroll: false,
        })
      }
      onSelect={(m) =>
        void navigate({
          search: (prev) => ({ ...prev, map: m }),
          resetScroll: false,
        })
      }
    />
  )
}
