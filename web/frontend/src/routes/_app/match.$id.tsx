import { createFileRoute } from "@tanstack/react-router"

import { MixMatchRoom } from "@/features/mixes/MixRoomPages"
import { roomSearchSchema } from "@/features/mixes/search"

export const Route = createFileRoute("/_app/match/$id")({
  validateSearch: roomSearchSchema,
  component: MatchPage,
})

// Por ahora solo los mixes tienen sala; torneos y PCW siguen con el placeholder.
function MatchPage() {
  const { id } = Route.useParams()
  const { stats } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <MixMatchRoom
      id={id}
      tab={stats ?? "general"}
      onTab={(t) =>
        void navigate({
          search: { stats: t === "general" ? undefined : t },
          replace: true,
          // Es estado de la misma vista: no se vuelve arriba.
          resetScroll: false,
        })
      }
    />
  )
}
