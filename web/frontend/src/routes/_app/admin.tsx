import { Outlet, createFileRoute } from "@tanstack/react-router"

import { requireAdminSection, requireAuth } from "@/auth/guards"

// Administración: primero la sesión; después la guarda decide por rol y sección (ver auth/permissions.ts).
export const Route = createFileRoute("/_app/admin")({
  beforeLoad: async (args) => {
    const { user } = await requireAuth(args)
    requireAdminSection({ ...args, context: { ...args.context, user } })
    return { user }
  },
  component: Outlet,
})
