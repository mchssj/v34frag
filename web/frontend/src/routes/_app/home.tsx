import { createFileRoute } from "@tanstack/react-router"

import { useMe } from "@/auth/queries"
import { HomePage } from "@/features/home/pages/HomePage"
import { apiMmSource } from "@/features/matchmaking/apiSource"
import { MmSourceContext } from "@/features/matchmaking/source"

export const Route = createFileRoute("/_app/home")({
  component: Home,
})

function Home() {
  const initial = Route.useRouteContext({ select: (c) => c.user })
  const user = useMe().data ?? initial
  // Pendientes y Jugar leen el estado del matchmaking, como /play.
  return (
    <MmSourceContext value={apiMmSource}>
      <HomePage name={user.tag ?? "jugador"} />
    </MmSourceContext>
  )
}
