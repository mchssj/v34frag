import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/players/compare")({
  component: ComparePage,
})

function ComparePage() {
  return <Placeholder title="Comparar jugadores" />
}
