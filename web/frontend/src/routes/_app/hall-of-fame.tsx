import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/hall-of-fame")({
  component: HallOfFamePage,
})

function HallOfFamePage() {
  return <Placeholder title="Palmarés" />
}
