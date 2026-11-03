import { createFileRoute } from "@tanstack/react-router"

import { TermsPage } from "@/features/legal/pages/TermsPage"

// Pública: con o sin sesión.
export const Route = createFileRoute("/terminos")({
  component: TermsPage,
})
