import { createFileRoute } from "@tanstack/react-router"

import { LauncherPage } from "@/features/launcher/pages/LauncherPage"

// Pública: con o sin sesión.
export const Route = createFileRoute("/launcher")({
  component: LauncherPage,
})
