import { createFileRoute } from "@tanstack/react-router"

import { requireAuth } from "@/auth/guards"

import { ProfileLayout } from "@/features/profile/pages/ProfileLayout"

export const Route = createFileRoute("/_app/profile")({
  beforeLoad: requireAuth,
  component: ProfileLayout,
})
