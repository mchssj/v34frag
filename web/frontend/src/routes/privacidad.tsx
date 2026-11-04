import { createFileRoute } from "@tanstack/react-router"

import { PrivacyPage } from "@/features/legal/pages/PrivacyPage"

// Pública: con o sin sesión.
export const Route = createFileRoute("/privacidad")({
  component: PrivacyPage,
})
