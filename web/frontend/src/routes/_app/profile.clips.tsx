import { createFileRoute } from "@tanstack/react-router"

import { ClipsSection } from "@/features/profile/pages/ClipsSection"

export const Route = createFileRoute("/_app/profile/clips")({
  component: ClipsSection,
})
