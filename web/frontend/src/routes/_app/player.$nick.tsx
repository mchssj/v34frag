import { createFileRoute } from "@tanstack/react-router"

import { PlayerProfile } from "@/features/player/PlayerProfile"
import { playerSearchSchema } from "@/features/player/search"

export const Route = createFileRoute("/_app/player/$nick")({
  validateSearch: playerSearchSchema,
  component: PlayerPage,
})

function PlayerPage() {
  const { nick } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <PlayerProfile
      // Al cambiar de jugador se arma de nuevo (vuelve el estado del gráfico).
      key={nick.toLowerCase()}
      nick={nick}
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
