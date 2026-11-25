import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { EloPage } from "@/features/elo/pages/EloPage"

export const Route = createFileRoute("/_app/elo")({
  validateSearch: z.object({
    page: z.number().int().min(1).optional().catch(undefined),
  }),
  component: Elo,
})

function Elo() {
  const { page = 1 } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <EloPage
      page={page}
      onPage={(p) =>
        void navigate({
          search: { page: p === 1 ? undefined : p },
          replace: true,
          resetScroll: false,
        })
      }
    />
  )
}
