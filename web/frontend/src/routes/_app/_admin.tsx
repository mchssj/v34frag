import {
  Link,
  Outlet,
  createFileRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router"

import { ForbiddenError, requireRole } from "@/auth/guards"
import { RouteError } from "@/components/RouteError"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/_app/_admin")({
  beforeLoad: requireRole("admin"),
  errorComponent: AdminError,
  component: Outlet,
})

function AdminError(props: ErrorComponentProps) {
  if (!(props.error instanceof ForbiddenError)) return <RouteError {...props} />
  return (
    <main className="flex min-h-[60svh] flex-col items-center justify-center gap-4 text-center">
      <p className="font-heading text-5xl font-bold text-muted-foreground">
        403
      </p>
      <h1 className="font-heading text-2xl font-semibold">Sin permiso</h1>
      <p className="text-muted-foreground">{props.error.message}</p>
      <Button asChild>
        <Link to="/home">Volver al inicio</Link>
      </Button>
    </main>
  )
}
