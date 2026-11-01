import { createFileRoute, redirect } from "@tanstack/react-router"

// "Resultados" quedó dentro de Partidas: un link viejo lleva ahí.
export const Route = createFileRoute("/_app/matches/results")({
  beforeLoad: () => {
    throw redirect({ to: "/matches", replace: true })
  },
})
