import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { COMPARE_PLAYERS } from "@/features/compare5/demo"
import {
  MultiCompare,
  VIP_MAX,
  type Picked,
} from "@/features/compare5/MultiCompare"

// Ejemplo del comparador de hasta 5 jugadores para VIP sin API ni sesión
// (docs/bitacora/2026-10-29-comparador-5 en kyan/pruebas). Solo en `pnpm dev`.
export const Route = createFileRoute("/demo/comparador")({
  validateSearch: z.object({
    p: z.string().max(200).optional().catch(undefined),
  }),
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoComparador,
})

const parse = (p?: string) =>
  (p ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, VIP_MAX)

const TOP5 = [...COMPARE_PLAYERS].sort((a, b) => b.elo - a.elo).slice(0, 5)

function DemoComparador() {
  const { p } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [vip, setVip] = useState(true)
  // El color de cada jugador se guarda acá: sacar a uno no le cambia el color a los demás.
  const [picked, setPicked] = useState<Picked[]>(() =>
    (p ? parse(p) : TOP5.slice(0, 2).map((x) => x.nick)).map((nick, slot) => ({
      nick,
      slot,
    }))
  )

  const change = (next: Picked[]) => {
    setPicked(next)
    void navigate({
      search: {
        p: next.length ? next.map((x) => x.nick).join(",") : undefined,
      },
      replace: true,
    })
  }

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
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            change(TOP5.map((x, slot) => ({ nick: x.nick, slot })))
          }
        >
          Comparar el top 5
        </Button>
        <Button size="sm" variant="ghost" onClick={() => change([])}>
          Reiniciar
        </Button>
      </div>
      <h1 className="text-2xl font-semibold tracking-[-0.4px]">
        Comparar jugadores
      </h1>
      <MultiCompare picked={picked} onChange={change} vip={vip} />
    </div>
  )
}
