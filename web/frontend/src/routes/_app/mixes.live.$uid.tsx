import { createFileRoute } from "@tanstack/react-router"

import { MixLiveRoom } from "@/features/mixes/pages/MixRoomPages"
import { roomSearchSchema } from "@/features/mixes/lib/search"

export const Route = createFileRoute("/_app/mixes/live/$uid")({
  validateSearch: roomSearchSchema,
  component: LiveMixPage,
})

function LiveMixPage() {
  const { uid } = Route.useParams()
  const { stats } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <MixLiveRoom
      uid={uid}
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
