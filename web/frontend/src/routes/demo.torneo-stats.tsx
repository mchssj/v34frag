import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { TOURNAMENT, TournamentStats } from "@/features/vip/TournamentStats"

// Ejemplo de las stats avanzadas post-torneo que los VIP ven antes, sin API ni sesión
// (docs/bitacora/2026-10-29-stats-torneo en kyan/pruebas). Solo en `pnpm dev`.
export const Route = createFileRoute("/demo/torneo-stats")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoTorneoStats,
})

const END = new Date(TOURNAMENT.ended_at).getTime()
const MOMENTS = {
  recien: { label: "Recién terminó", at: END + 3_600_000 },
  manana: { label: "Pasaron 30 h", at: END + 30 * 3_600_000 },
} as const

function DemoTorneoStats() {
  const [vip, setVip] = useState(false)
  const [moment, setMoment] = useState<keyof typeof MOMENTS>("recien")
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
          {(Object.keys(MOMENTS) as (keyof typeof MOMENTS)[]).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={moment === k ? "secondary" : "ghost"}
              aria-pressed={moment === k}
              onClick={() => setMoment(k)}
            >
              {MOMENTS[k].label}
            </Button>
          ))}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.4px]">
          {TOURNAMENT.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Final: Los Pibes 2 – 1 TNT
        </p>
      </div>
      <TournamentStats vip={vip} now={MOMENTS[moment].at} />
    </div>
  )
}
