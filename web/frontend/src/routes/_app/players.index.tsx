import { createFileRoute, redirect } from "@tanstack/react-router"

// Los jugadores se buscan en el ranking.
export const Route = createFileRoute("/_app/players/")({
  beforeLoad: () => {
    throw redirect({ to: "/ranking", replace: true })
  },
})
