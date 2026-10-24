import { Outlet, createFileRoute } from "@tanstack/react-router"

import { requireAdminSection } from "@/auth/guards"

// Administración: la guarda decide por rol y sección (ver auth/permissions.ts).
export const Route = createFileRoute("/_app/admin")({
  beforeLoad: requireAdminSection,
  component: Outlet,
})
