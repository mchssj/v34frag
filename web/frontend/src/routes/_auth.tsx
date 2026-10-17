import { Outlet, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { requireGuest } from "@/auth/guards"

const searchSchema = z.object({
  // Se valida de nuevo con safeRedirect antes de usarlo.
  redirect: z.string().optional().catch(undefined),
})

// Páginas sin sesión (login y registro). Cada una arma su AuthShell.
export const Route = createFileRoute("/_auth")({
  validateSearch: searchSchema,
  beforeLoad: requireGuest,
  component: Outlet,
})
