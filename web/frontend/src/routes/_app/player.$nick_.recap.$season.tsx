import { createFileRoute } from "@tanstack/react-router"

import { RecapPage } from "@/features/player/recap/RecapPage"

// Recap de la temporada de un jugador (bitácora 2026-11-19-estadisticas-de-temporada). URL propia para compartirlo.
export const Route = createFileRoute("/_app/player/$nick_/recap/$season")({
  component: RecapRoute,
})

function RecapRoute() {
  const { nick, season: raw } = Route.useParams()
  // Un número inválido llega a la API y vuelve como error (400).
  const season = Number.parseInt(raw, 10)
  const navigate = Route.useNavigate()
  return (
    <RecapPage
      nick={nick}
      season={season}
      onClose={() =>
        void navigate({
          to: "/player/$nick",
          params: { nick },
          search: { tab: "temporadas" },
        })
      }
    />
  )
}
