import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { SeasonStats } from "@/features/ranking/pages/SeasonStats"

// Estadísticas de toda la temporada (bitácora 2026-11-19-estadisticas-de-temporada).
export const Route = createFileRoute("/_app/season/$number")({
  params: {
    parse: (p) => ({ number: z.coerce.number().int().min(1).parse(p.number) }),
    stringify: (p) => ({ number: String(p.number) }),
  },
  component: SeasonRoute,
})

function SeasonRoute() {
  const { number } = Route.useParams()
  return <SeasonStats key={number} number={number} />
}
