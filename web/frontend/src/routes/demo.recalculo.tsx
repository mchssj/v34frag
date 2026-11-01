import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ME, STANDINGS } from "@/features/season/demo"
import { RecalcPreview } from "@/features/season/RecalcPreview"

// Ejemplo de la vista previa del próximo recálculo de ranking para VIP sin API ni sesión
// (docs/bitacora/2026-10-29-proximo-recalculo en kyan/pruebas). Solo en `pnpm dev`.
export const Route = createFileRoute("/demo/recalculo")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoRecalculo,
})

const CASES = {
  falta: { label: "Me faltan mixes", elo: 2041, matches: 17 },
  top: { label: "Estoy en el top", elo: 2216, matches: 34 },
  fuera: { label: "Fuera del top", elo: 1840, matches: 26 },
} as const

function DemoRecalculo() {
  const [vip, setVip] = useState(true)
  const [c, setC] = useState<keyof typeof CASES>("falta")
  const list = STANDINGS.map((s) =>
    s.id === ME ? { ...s, elo: CASES[c].elo, matches: CASES[c].matches } : s
  )
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
        <span className="inline-flex rounded-lg border p-0.5">
          {(Object.keys(CASES) as (keyof typeof CASES)[]).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={c === k ? "secondary" : "ghost"}
              aria-pressed={c === k}
              onClick={() => setC(k)}
            >
              {CASES[k].label}
            </Button>
          ))}
        </span>
      </div>
      <section className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold">
          Tu próximo recálculo
        </h1>
        <p className="text-sm text-muted-foreground">
          Qué te toca cuando cierre la temporada, y qué podés cambiar antes.
        </p>
      </section>
      <RecalcPreview vip={vip} list={list} />
    </div>
  )
}
