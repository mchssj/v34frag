import { createFileRoute } from "@tanstack/react-router"

import { ProfileLayout } from "@/features/profile/pages/ProfileLayout"

export const Route = createFileRoute("/_app/profile")({
  component: ProfileLayout,
})
