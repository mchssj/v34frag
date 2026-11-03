import { createFileRoute } from "@tanstack/react-router"

import { FaqPage } from "@/features/legal/pages/FaqPage"

// Pública: con o sin sesión.
export const Route = createFileRoute("/ayuda")({
  component: FaqPage,
})
