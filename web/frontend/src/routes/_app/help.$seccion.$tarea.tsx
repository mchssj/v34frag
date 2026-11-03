import { createFileRoute } from "@tanstack/react-router"

import { HelpPage } from "@/features/help/pages/HelpPage"

export const Route = createFileRoute("/_app/help/$seccion/$tarea")({
  component: HelpPageRoute,
})

function HelpPageRoute() {
  const { seccion, tarea } = Route.useParams()
  return <HelpPage seccion={seccion} tarea={tarea} />
}
