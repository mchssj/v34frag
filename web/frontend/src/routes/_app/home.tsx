import { createFileRoute } from "@tanstack/react-router"

import { requireAuth } from "@/auth/guards"

import { useMe } from "@/auth/queries"
import { ProfileBanner } from "@/features/onboarding/components/ProfileBanner"

export const Route = createFileRoute("/_app/home")({
  beforeLoad: requireAuth,
  component: HomePage,
})

// Provisorio: el resto del Home llega con su propio handoff.
function HomePage() {
  const initial = Route.useRouteContext({ select: (c) => c.user })
  const user = useMe().data ?? initial

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-[-0.5px]">
        Hola, {user.tag ?? "jugador"}
      </h1>
      <ProfileBanner />
    </div>
  )
}
