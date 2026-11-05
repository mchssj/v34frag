import { createFileRoute } from "@tanstack/react-router"

import { TermsPage } from "@/features/legal/pages/TermsPage"
import { usePageMeta } from "@/lib/seo"

// Pública: con o sin sesión.
export const Route = createFileRoute("/terminos")({
  component: TermsRoute,
})

function TermsRoute() {
  usePageMeta({
    title: "Términos y condiciones",
    description: "Términos y condiciones de uso de CM League.",
  })
  return <TermsPage />
}
