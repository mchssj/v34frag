import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { VipPage, type VipState } from "@/features/vip/VipPage"

// Ejemplo de la página "Hacete VIP" sin API ni sesión (docs/bitacora/2026-10-29-hacete-vip en kyan/pruebas).
// Solo en `pnpm dev`. Es adonde llevan los candados de todos los demos VIP.
export const Route = createFileRoute("/demo/vip")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoVip,
})

const STATES: Record<string, { label: string; state: VipState }> = {
  none: { label: "Sin VIP", state: { kind: "none" } },
  active: { label: "Activo", state: { kind: "active", daysLeft: 18 } },
  soon: { label: "Por vencer", state: { kind: "active", daysLeft: 3 } },
  grace: { label: "En gracia", state: { kind: "grace", daysLeft: 1 } },
  expired: { label: "Vencido", state: { kind: "expired", daysAgo: 12 } },
}

function DemoVip() {
  const [s, setS] = useState("none")
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        <span className="text-xs text-muted-foreground">Tu VIP:</span>
        <span className="inline-flex flex-wrap rounded-lg border p-0.5">
          {Object.entries(STATES).map(([k, v]) => (
            <Button
              key={k}
              size="sm"
              variant={s === k ? "secondary" : "ghost"}
              aria-pressed={s === k}
              onClick={() => setS(k)}
            >
              {v.label}
            </Button>
          ))}
        </span>
      </div>
      <VipPage state={STATES[s]!.state} />
    </div>
  )
}
