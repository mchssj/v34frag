import { createFileRoute } from "@tanstack/react-router"

import { PreferencesSection } from "@/features/profile/pages/PreferencesSection"

export const Route = createFileRoute("/_app/profile/preferences")({
  component: PreferencesSection,
})
