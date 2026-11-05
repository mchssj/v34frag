import { createFileRoute } from "@tanstack/react-router"

import { RegisterFlow } from "@/features/auth/pages/RegisterFlow"
import { usePageMeta } from "@/lib/seo"

export const Route = createFileRoute("/_auth/register")({
  component: RegisterRoute,
})

function RegisterRoute() {
  usePageMeta({ title: "Crear cuenta", noindex: true })
  return <RegisterFlow />
}
