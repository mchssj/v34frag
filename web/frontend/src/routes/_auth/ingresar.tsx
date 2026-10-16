import { createFileRoute } from "@tanstack/react-router"
import { CircleCheckIcon, CircleAlertIcon } from "lucide-react"
import { z } from "zod"

import { safeRedirect } from "@/auth/redirect"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LoginForm } from "@/features/auth/LoginForm"

const searchSchema = z.object({
  aviso: z
    .enum(["cuenta-confirmada", "enlace-invalido"])
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute("/_auth/ingresar")({
  validateSearch: searchSchema,
  component: LoginPage,
})

function LoginPage() {
  const { redirect, aviso } = Route.useSearch()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresar</CardTitle>
        <CardDescription>Entra con tu email y contraseña.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {aviso === "cuenta-confirmada" && (
          <Alert>
            <CircleCheckIcon />
            <AlertDescription>
              Tu cuenta quedó confirmada. Ya puedes iniciar sesión.
            </AlertDescription>
          </Alert>
        )}
        {aviso === "enlace-invalido" && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertDescription>
              El enlace de confirmación no es válido o venció. Prueba iniciar
              sesión; si tu email no está confirmado, regístrate de nuevo para
              recibir otro enlace.
            </AlertDescription>
          </Alert>
        )}
        <LoginForm redirectTo={safeRedirect(redirect)} />
      </CardContent>
    </Card>
  )
}
