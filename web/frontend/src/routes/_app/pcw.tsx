import { createFileRoute } from "@tanstack/react-router"

import { requireAuth } from "@/auth/guards"

import { Placeholder } from "@/features/shell/components/Placeholder"

export const Route = createFileRoute("/_app/pcw")({
  beforeLoad: requireAuth,
  component: PcwPage,
})

function PcwPage() {
  return <Placeholder title="PCW" />
}
