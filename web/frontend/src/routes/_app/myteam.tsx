import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/myteam")({
  component: MyTeamPage,
})

function MyTeamPage() {
  return <Placeholder title="Mi equipo" />
}
