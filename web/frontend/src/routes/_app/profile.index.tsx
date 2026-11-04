import { createFileRoute } from "@tanstack/react-router"

import { ProfileSection } from "@/features/profile/pages/ProfileSection"

export const Route = createFileRoute("/_app/profile/")({
  component: ProfileSection,
})
