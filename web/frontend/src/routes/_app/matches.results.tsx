import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/matches/results")({
  component: ResultsPage,
})

function ResultsPage() {
  return <Placeholder title="Resultados" />
}
