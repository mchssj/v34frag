import { createFileRoute } from "@tanstack/react-router"

import { SupportPage } from "@/features/legal/pages/SupportPage"

// Pública: con o sin sesión.
export const Route = createFileRoute("/soporte")({
  component: SupportPage,
})
