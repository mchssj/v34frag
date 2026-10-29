import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { RankingVip } from "@/features/vip/RankingVip"

// Ejemplo del ranking con las marcas VIP y el Top VIP del mes, sin API ni sesión
// (docs/bitacora/2026-10-29-ranking-vip en kyan/pruebas). Solo en `pnpm dev`.
export const Route = createFileRoute("/demo/ranking-vip")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoRankingVip,
})

function DemoRankingVip() {
  const [onlyVip, setOnlyVip] = useState(false)
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Switch
            id="demo-only"
            size="sm"
            checked={onlyVip}
            onCheckedChange={setOnlyVip}
          />
          <Label htmlFor="demo-only" className="text-xs">
            Mostrar solo VIP en la tabla
          </Label>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.4px]">Ranking</h1>
        <p className="max-w-[62ch] text-sm text-pretty text-muted-foreground">
          Los VIP llevan el borde dorado, la medalla VIP al lado del nombre y el
          tilde de cuenta verificada.
        </p>
      </div>
      <RankingVip onlyVip={onlyVip} />
    </div>
  )
}
