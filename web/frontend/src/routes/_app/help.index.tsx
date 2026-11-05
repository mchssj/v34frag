import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { requireAuth } from "@/auth/guards"
import { HelpIndex } from "@/features/help/pages/HelpIndex"

// Ayuda: el manual de usuario (plan docs/bitacora/2026-11-02-manual-usuario). La API manda solo las
// secciones del rol de la cuenta y pide sesión (GET /api/v1/manual responde 401 sin ella).
const SECCIONES = [
  "jugador",
  "capitan",
  "organizador",
  "moderador",
  "admin",
  "streamer",
  "servidor-externo",
] as const

export const Route = createFileRoute("/_app/help/")({
  beforeLoad: requireAuth,
  validateSearch: z.object({
    seccion: z.enum(SECCIONES).optional().catch(undefined),
  }),
  component: HelpRoute,
})

function HelpRoute() {
  const { seccion } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <HelpIndex
      seccion={seccion}
      onSeccion={(s) =>
        void navigate({
          search: { seccion: s },
          replace: true,
          resetScroll: false,
        })
      }
    />
  )
}
