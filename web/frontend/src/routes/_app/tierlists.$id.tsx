import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { TierlistPage } from "@/features/tierlists/pages/TierlistPage"

// Una tierlist (replanteo 137). `?editar=true` abre el editor si es del que mira.
export const Route = createFileRoute("/_app/tierlists/$id")({
  validateSearch: z.object({ editar: z.boolean().optional().catch(undefined) }),
  component: TierlistRoute,
})

function TierlistRoute() {
  const { id } = Route.useParams()
  const { editar } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <TierlistPage
      key={id}
      id={id}
      edit={!!editar}
      onEdit={(on) =>
        void navigate({
          search: on ? { editar: true } : {},
          resetScroll: false,
        })
      }
    />
  )
}
