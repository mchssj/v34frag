import { createFileRoute } from "@tanstack/react-router"

import { useMe } from "@/auth/queries"
import { ProfileBanner } from "@/features/onboarding/ProfileBanner"

export const Route = createFileRoute("/_app/home")({
  component: HomePage,
})

// Provisorio: el resto del Home llega con su propio handoff.
function HomePage() {
  const initial = Route.useRouteContext({ select: (c) => c.user })
  const user = useMe().data ?? initial

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-[-0.5px]">
        Hola, {user.tag ?? "jugador"}
      </h1>
      <ProfileBanner />
    </div>
  )
}
