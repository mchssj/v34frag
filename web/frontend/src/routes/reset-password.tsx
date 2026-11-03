import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { z } from "zod"

import { AuthShell } from "@/features/auth/components/AuthShell"
import { ResetPasswordForm } from "@/features/auth/pages/ResetPasswordForm"

const searchSchema = z.object({
  token_hash: z.string().max(256).optional().catch(undefined),
  type: z.string().optional().catch(undefined),
})

// Fuera de _auth: el link del correo tiene que funcionar aunque haya otra sesión abierta en el navegador.
export const Route = createFileRoute("/reset-password")({
  validateSearch: searchSchema,
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  // El token queda en memoria y sale de la barra (y del historial) antes de usarlo.
  const [tokenHash] = useState(() =>
    search.type === "recovery" && search.token_hash ? search.token_hash : null
  )
  useEffect(() => {
    if (search.token_hash || search.type)
      void navigate({ to: "/reset-password", search: {}, replace: true })
  }, [search.token_hash, search.type, navigate])

  return (
    <AuthShell swap={{ label: "Iniciar sesión", to: "/login" }} side={null}>
      <ResetPasswordForm tokenHash={tokenHash} />
    </AuthShell>
  )
}
