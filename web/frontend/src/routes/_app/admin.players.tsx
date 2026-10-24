import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/admin/players")({
  component: AdminPlayersPage,
})

function AdminPlayersPage() {
  return <Placeholder title="Jugadores" />
}
