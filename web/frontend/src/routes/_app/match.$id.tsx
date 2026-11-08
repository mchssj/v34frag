import { createFileRoute } from "@tanstack/react-router"

import { MixMatchRoom } from "@/features/mixes/pages/MixRoomPages"
import { roomSearchSchema } from "@/features/mixes/lib/search"

export const Route = createFileRoute("/_app/match/$id")({
  validateSearch: roomSearchSchema,
  component: MatchPage,
})

// Un mix abre su sala; una serie de torneo o PCW, la página de la serie.
function MatchPage() {
  const { id } = Route.useParams()
  const { stats, map, view } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <MixMatchRoom
      id={id}
      tab={stats ?? "general"}
      onTab={(t) =>
        void navigate({
          search: (s) => ({ ...s, stats: t === "general" ? undefined : t }),
          replace: true,
          // Es estado de la misma vista: no se vuelve arriba.
          resetScroll: false,
        })
      }
      map={map}
      view={view}
      onMap={(g) =>
        void navigate({
          search: (s) => ({ ...s, map: g }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  )
}
