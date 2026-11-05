import { createFileRoute } from "@tanstack/react-router"

import { requireAuth } from "@/auth/guards"

import { apiMmSource } from "@/features/matchmaking/apiSource"
import { PlayPage } from "@/features/matchmaking/PlayPage"
import { MmSourceContext } from "@/features/matchmaking/source"

export const Route = createFileRoute("/_app/play")({
  beforeLoad: requireAuth,
  component: PlayRoute,
})

function PlayRoute() {
  return (
    <MmSourceContext value={apiMmSource}>
      <PlayPage />
    </MmSourceContext>
  )
}
