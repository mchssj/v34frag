import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/components/Placeholder"

export const Route = createFileRoute("/_app/pcw")({
  component: PcwPage,
})

function PcwPage() {
  return <Placeholder title="PCW" />
}
