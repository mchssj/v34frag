import { createFileRoute } from "@tanstack/react-router"

import { apiMmSource } from "@/features/matchmaking/apiSource"
import { ReplacePage } from "@/features/matchmaking/ReplacePage"
import { MmSourceContext } from "@/features/matchmaking/source"

// Link de reemplazo de Discord (replanteo 75). Sin sesión, la guarda de _app pide iniciarla y vuelve acá.
export const Route = createFileRoute("/_app/mm/reemplazo/$token")({
  component: ReplaceRoute,
})

function ReplaceRoute() {
  const { token } = Route.useParams()
  return (
    <MmSourceContext value={apiMmSource}>
      <ReplacePage token={token} />
    </MmSourceContext>
  )
}
