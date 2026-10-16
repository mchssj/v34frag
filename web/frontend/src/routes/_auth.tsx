import { Link, Outlet, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { requireGuest } from "@/auth/guards"

const searchSchema = z.object({
  // Se valida de nuevo con safeRedirect antes de usarlo.
  redirect: z.string().optional().catch(undefined),
})

export const Route = createFileRoute("/_auth")({
  validateSearch: searchSchema,
  beforeLoad: requireGuest,
  component: AuthLayout,
})

// Layout de las páginas de cuenta (sin sesión). Provisorio hasta el diseño final.
function AuthLayout() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <Link to="/" className="font-heading text-2xl font-bold tracking-tight">
        v34frag
      </Link>
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </main>
  )
}
