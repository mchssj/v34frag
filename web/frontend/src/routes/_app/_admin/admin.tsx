import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/_admin/admin")({
  component: AdminPage,
})

// Provisoria: comprueba la guarda de rol hasta que existan los paneles de admin.
function AdminPage() {
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="font-heading text-2xl font-semibold">Administración</h1>
      <p className="text-muted-foreground">
        Los paneles de admin se agregan en las próximas fases.
      </p>
    </div>
  )
}
