import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/players/")({
  component: PlayersPage,
})

function PlayersPage() {
  return <Placeholder title="Jugadores" />
}
