import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

// El listado de mixes pasó a Partidas: /mixes lleva ahí con el filtro Mix (y la búsqueda y el
// mapa que traiga el link viejo). La sala del mix sigue en /match/{id} y /mixes/live/{uid}.
const legacySearch = z.object({
  q: z.string().max(60).optional().catch(undefined),
  map: z.string().max(40).optional().catch(undefined),
})

export const Route = createFileRoute("/_app/mixes/")({
  validateSearch: legacySearch,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/matches",
      search: { kind: "mix", q: search.q, map: search.map },
      replace: true,
    })
  },
})
