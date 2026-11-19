import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Favorites } from "@/features/vip/Favorites"

// Ejemplo de las partidas favoritas para VIP, sin API ni sesión
// (docs/bitacora/2026-10-29-partidas-favoritas en kyan/pruebas). Solo en `pnpm dev`.
export const Route = createFileRoute("/demo/favoritas")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoFavoritas,
})

function DemoFavoritas() {
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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.4px]">Mis mixes</h1>
        <p className="text-sm text-muted-foreground">
          Marcá con la estrella los mixes que querés tener a mano: una
          remontada, tu mejor partido o la demo para revisar.
        </p>
      </div>
      <Favorites vip={vip} />
    </div>
  )
}
