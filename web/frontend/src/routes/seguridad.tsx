import { createFileRoute } from "@tanstack/react-router"

import { SecurityPage } from "@/features/legal/pages/SecurityPage"

// Pública: con o sin sesión.
export const Route = createFileRoute("/seguridad")({
  component: SecurityPage,
})
