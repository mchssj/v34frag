import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { EloBreakdown } from "@/features/elo/EloBreakdown"

// Ejemplo del desglose de la fórmula de ELO para VIP sin API ni sesión
// (docs/bitacora/2026-10-29-desglose-elo en kyan/pruebas). Solo en `pnpm dev`.
export const Route = createFileRoute("/demo/elo")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoElo,
})

function DemoElo() {
  const [vip, setVip] = useState(true)
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Switch
            id="demo-vip"
            size="sm"
            checked={vip}
            onCheckedChange={setVip}
          />
          <Label htmlFor="demo-vip" className="text-xs">
            Ser VIP
          </Label>
        </span>
      </div>
      <section className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold">
          Tu fórmula de ELO
        </h1>
        <p className="text-sm text-muted-foreground">
          De dónde sale cada punto que ganaste o perdiste. Es el mismo cálculo
          que hace el servidor.
        </p>
      </section>
      <EloBreakdown vip={vip} />
    </div>
  )
}
