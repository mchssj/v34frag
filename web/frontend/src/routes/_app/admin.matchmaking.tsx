import { createFileRoute } from "@tanstack/react-router"

import { AdminMatchmaking } from "@/features/matchmaking/admin/AdminMatchmaking"
import { apiMmSource } from "@/features/matchmaking/apiSource"
import { MmSourceContext } from "@/features/matchmaking/source"

export const Route = createFileRoute("/_app/admin/matchmaking")({
  component: AdminMatchmakingPage,
})

function AdminMatchmakingPage() {
  return (
    <MmSourceContext value={apiMmSource}>
      <AdminMatchmaking />
    </MmSourceContext>
  )
}
