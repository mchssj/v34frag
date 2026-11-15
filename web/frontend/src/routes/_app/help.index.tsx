import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { useMe } from "@/auth/queries"
import { HelpIndex } from "@/features/help/pages/HelpIndex"
import { useGuide } from "@/features/onboarding/components/FirstVisitGuide"

// Ayuda: el manual de usuario (plan docs/bitacora/2026-11-02-manual-usuario). La API manda solo las
// secciones del rol de la cuenta; _app ya exige sesión.
const SECCIONES = [
  "jugador",
  "capitan",
  "organizador",
  "soporte",
  "moderador",
  "admin",
  "streamer",
  "servidor-externo",
] as const

export const Route = createFileRoute("/_app/help/")({
  validateSearch: z.object({
    seccion: z.enum(SECCIONES).optional().catch(undefined),
  }),
  component: HelpRoute,
})

function HelpRoute() {
  const { seccion } = Route.useSearch()
  const navigate = Route.useNavigate()
  const initial = Route.useRouteContext({ select: (c) => c.user })
  const guide = useGuide(useMe().data ?? initial)
  return (
    <>
      {guide.dialog}
      <HelpIndex
        onGuide={guide.open}
        seccion={seccion}
        onSeccion={(s) =>
          void navigate({
            search: { seccion: s },
            replace: true,
            resetScroll: false,
          })
        }
      />
    </>
  )
}
