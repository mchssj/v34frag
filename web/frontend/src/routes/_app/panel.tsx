import { createFileRoute } from "@tanstack/react-router"

import { useMe } from "@/auth/queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ROLE_LABEL } from "@/auth/roles"

export const Route = createFileRoute("/_app/panel")({
  component: PanelPage,
})

// Provisoria: sirve para verificar la sesión hasta que existan las vistas reales.
function PanelPage() {
  const initial = Route.useRouteContext({ select: (c) => c.user })
  const user = useMe().data ?? initial

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Hola, {user.tag ?? "jugador"}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Email</dt>
          <dd>{user.email ?? "—"}</dd>
          <dt className="text-muted-foreground">Rol</dt>
          <dd>{ROLE_LABEL[user.role]}</dd>
          <dt className="text-muted-foreground">Registro</dt>
          <dd>
            {user.created_at
              ? new Date(user.created_at).toLocaleDateString("es")
              : "—"}
          </dd>
        </dl>
      </CardContent>
    </Card>
  )
}
