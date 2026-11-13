import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { SeedingTab } from "@/features/admin/events/components/SeedingTab"
import {
  TEMPLATE_LABEL,
  type Template,
} from "@/features/admin/events/lib/model"
import { eventRegistrationsOptions } from "@/features/events/api/queries"
import type { EventDetail, Registration } from "@/features/events/types"

// La pestaña Siembra sin API ni sesión (docs/bitacora/2026-11-09-siembra-sobre-la-llave). Solo en
// `pnpm dev`: en el build de producción la ruta no existe. Guardar falla, porque el torneo no existe.
export const Route = createFileRoute("/demo/siembra")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoSiembra,
})

const NAMES = [
  "Ocaso Gaming",
  "Vértigo",
  "Los Halcones",
  "Nébula Five",
  "Raíz eSports",
  "Distrito 9",
  "Pampa Rush",
  "Kraken CS",
  "Furia Norte",
  "Cóndor",
  "Brasa",
  "Tormenta",
  "Lince",
  "Puma Team",
  "Andes",
  "Delta",
  "Zafiro",
  "Roble",
  "Ícaro",
  "Faro",
  "Quimera",
  "Volcán",
  "Sur",
  "Neón",
]

const FORMATS: { template: Template; config: object; n: number }[] = [
  { template: "single", config: {}, n: 8 },
  { template: "single", config: {}, n: 6 },
  { template: "double", config: {}, n: 8 },
  { template: "groups", config: { groups: 2, advance: 2 }, n: 8 },
  { template: "groups_double", config: { groups: 2, advance: 3 }, n: 8 },
  { template: "swiss", config: { stages: 1, size: 8, wins: 2 }, n: 8 },
  { template: "swiss", config: { stages: 2, size: 16, wins: 3 }, n: 24 },
]

function regs(n: number): Registration[] {
  return NAMES.slice(0, n).map((name, i) => ({
    team: {
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      name,
      tag: name.slice(0, 3).toUpperCase(),
      logo_url: null,
    } as Registration["team"],
    seed: i + 1,
    start_stage: 1,
    players: Array.from({ length: i === 4 ? 4 : 5 }, (_, k) => ({
      player_id: `p-${i}-${k}`,
      alias: `jugador${k}`,
      role: "active" as const,
    })),
    guests: [],
  }))
}

function DemoSiembra() {
  const qc = useQueryClient()
  const [k, setK] = useState(0)
  const [generated, setGenerated] = useState(false)
  const f = FORMATS[k]
  const id = `demo-siembra-${k}`
  const key = eventRegistrationsOptions(id).queryKey
  qc.setQueryDefaults(key, { staleTime: Infinity, retry: false })
  if (!qc.getQueryData(key)) qc.setQueryData(key, regs(f.n))
  const event = {
    id,
    template: f.template,
    config: f.config,
    status: generated ? "in_progress" : "registration",
    players_per_team: 5,
    draw: false,
  } as unknown as EventDetail
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4">
      <div className="flex flex-wrap gap-2">
        {FORMATS.map((x, i) => (
          <Button
            key={i}
            variant={i === k ? "default" : "outline"}
            size="sm"
            onClick={() => setK(i)}
          >
            {TEMPLATE_LABEL[x.template]} · {x.n}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setGenerated((g) => !g)}
        >
          {generated ? "Volver a inscripciones" : "Simular fixture generado"}
        </Button>
      </div>
      <SeedingTab key={id + generated} event={event} />
    </div>
  )
}
