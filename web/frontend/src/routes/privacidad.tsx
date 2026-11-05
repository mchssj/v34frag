import { createFileRoute } from "@tanstack/react-router"

import { PrivacyPage } from "@/features/legal/pages/PrivacyPage"
import { usePageMeta } from "@/lib/seo"

// Pública: con o sin sesión.
export const Route = createFileRoute("/privacidad")({
  component: PrivacyRoute,
})

function PrivacyRoute() {
  usePageMeta({
    title: "Política de privacidad",
    description:
      "Qué datos guarda CM League, para qué y cómo pedir que se borren.",
  })
  return <PrivacyPage />
}
