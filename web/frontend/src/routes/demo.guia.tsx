import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import type { Role } from "@/auth/queries"
import { Button } from "@/components/ui/button"
import { GuideDialog } from "@/features/onboarding/components/GuideDialog"

// Prototipo de la guía de la primera vez (docs/bitacora/2026-11-14-guia-primera-vez), sin sesión.
// Solo en `pnpm dev`: en producción la ruta no existe.
export const Route = createFileRoute("/demo/guia")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoGuia,
})

const ROLES: { role: Role; label: string }[] = [
  { role: "user", label: "Jugador" },
  { role: "organizer", label: "Organizador" },
  { role: "moderator", label: "Moderador" },
  { role: "admin", label: "Admin" },
]

function DemoGuia() {
  const [role, setRole] = useState<Role>("user")
  const [open, setOpen] = useState(true)

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-sm">
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-5">
        <span className="font-semibold">Demo · Guía de la primera vez</span>
        <div className="flex flex-wrap justify-center gap-2">
          {ROLES.map((r) => (
            <Button
              key={r.role}
              size="sm"
              variant={r.role === role ? "default" : "outline"}
              onClick={() => setRole(r.role)}
            >
              {r.label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Abrir la guía
        </Button>
      </div>
      <GuideDialog
        open={open}
        role={role}
        onClose={() => setOpen(false)}
        onGo={(href) => toast(`Iría a ${href}`)}
      />
    </div>
  )
}
