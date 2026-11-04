import { createFileRoute } from "@tanstack/react-router"

import { PrivacySection } from "@/features/profile/pages/PrivacySection"

export const Route = createFileRoute("/_app/profile/privacy")({
  component: PrivacySection,
})
