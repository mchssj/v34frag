import { createFileRoute } from "@tanstack/react-router"

import { AdminAnticheatPage } from "@/features/admin/anticheat/AdminAnticheatPage"

export const Route = createFileRoute("/_app/admin/anticheat")({
  component: AdminAnticheatPage,
})
