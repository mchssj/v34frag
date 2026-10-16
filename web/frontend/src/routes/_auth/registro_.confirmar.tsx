import { Link, createFileRoute, useRouterState } from "@tanstack/react-router"
import { MailIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

declare module "@tanstack/react-router" {
  interface HistoryState {
    // El email va en el estado de navegación, no en la URL.
    signupEmail?: string
  }
}

export const Route = createFileRoute("/_auth/registro_/confirmar")({
  component: ConfirmEmailPage,
})

function ConfirmEmailPage() {
  // Al recargar el estado se pierde: se muestra un texto genérico.
  const email = useRouterState({ select: (s) => s.location.state.signupEmail })

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <MailIcon className="mb-2 size-10 text-muted-foreground" />
        <CardTitle>Revisa tu correo</CardTitle>
        <CardDescription>
          {email ? (
            <>
              Te enviamos un enlace a{" "}
              <span className="font-medium text-foreground">{email}</span> para
              confirmar tu cuenta.
            </>
          ) : (
            "Te enviamos un correo para confirmar tu cuenta."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-center text-sm text-muted-foreground">
        <p>Después de confirmarla, inicia sesión para completar tu perfil.</p>
        <Button asChild>
          <Link to="/ingresar" search={{}}>
            Ir a ingresar
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
