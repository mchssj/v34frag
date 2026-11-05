import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/components/Placeholder"
import { usePageMeta } from "@/lib/seo"

export const Route = createFileRoute("/_app/players/")({
  component: PlayersPage,
})

function PlayersPage() {
  usePageMeta({ title: "Jugadores" })
  return <Placeholder title="Jugadores" />
}
