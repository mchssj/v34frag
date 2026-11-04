import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { AuthShell } from "@/features/auth/components/AuthShell"
import { AuthNotice } from "@/features/auth/components/ui"
import { ForgotPasswordForm } from "@/features/auth/pages/ForgotPasswordForm"

const searchSchema = z.object({
  aviso: z.enum(["enlace-viejo"]).optional().catch(undefined),
})

export const Route = createFileRoute("/_auth/forgot-password")({
  validateSearch: searchSchema,
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const { aviso } = Route.useSearch()
  const notice =
    aviso === "enlace-viejo" ? (
      <AuthNotice tone="error">
        Ese enlace ya no sirve. Pide otro correo para elegir una contraseña
        nueva.
      </AuthNotice>
    ) : undefined

  return (
    <AuthShell swap={{ label: "Iniciar sesión", to: "/login" }} side={null}>
      <ForgotPasswordForm notice={notice} />
    </AuthShell>
  )
}
