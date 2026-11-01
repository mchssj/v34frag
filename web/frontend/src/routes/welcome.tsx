import { createFileRoute } from "@tanstack/react-router"

import { requireAuth } from "@/auth/guards"
import { useMe } from "@/auth/queries"
import { RouteError } from "@/components/RouteError"
import { WelcomeFlow } from "@/features/onboarding/WelcomeFlow"

// Con sesión, pero con el layout de Auth (sin el header de la app).
export const Route = createFileRoute("/welcome")({
  beforeLoad: requireAuth,
  errorComponent: RouteError,
  component: WelcomePage,
})

function WelcomePage() {
  const initial = Route.useRouteContext({ select: (c) => c.user })
  const user = useMe().data ?? initial
  return <WelcomeFlow user={user} />
}
