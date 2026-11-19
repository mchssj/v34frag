import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Credits } from "@/features/vip/Credits"

// Ejemplo de la página de créditos con los VIP, sin API ni sesión
// (docs/bitacora/2026-10-29-creditos en kyan/pruebas). Solo en `pnpm dev`.
export const Route = createFileRoute("/demo/creditos")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoCreditos,
})

function DemoCreditos() {
  const [vip, setVip] = useState(true)
  const [show, setShow] = useState(true)
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3 text-sm">
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
            Ser VIP (3 meses)
          </Label>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Switch
            id="demo-show"
            size="sm"
            checked={show}
            disabled={!vip}
            onCheckedChange={setShow}
          />
          <Label htmlFor="demo-show" className="text-xs">
            Aparecer en los créditos (lo elige cada VIP en su configuración)
          </Label>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.4px]">Créditos</h1>
        <p className="text-sm text-muted-foreground">
          La gente detrás de CM League.
        </p>
      </div>
      <Credits me={vip ? { nick: "tu.nick", months: 3, show } : null} />
    </div>
  )
}
