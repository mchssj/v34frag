import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AdvancedSearch } from "@/features/search/AdvancedSearch"
import { searchSchema } from "@/features/search/filters"

// Ejemplo del buscador con filtros avanzados para VIP sin API ni sesión
// (docs/bitacora/2026-10-29-buscador-avanzado en kyan/pruebas). Solo en `pnpm dev`: en el build de
// producción la ruta no existe.
export const Route = createFileRoute("/demo/buscador")({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoBuscador,
})

function DemoBuscador() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
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
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void navigate({
              search: { eloMin: 1500, kd: 1.1, act: 30 },
              replace: true,
            })
          }
        >
          Ejemplo: buenos y activos
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void navigate({
              search: { tab: "partidas", diff: 3, demo: true, msort: "close" },
              replace: true,
            })
          }
        >
          Ejemplo: partidas parejas con demo
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void navigate({ search: {}, replace: true })}
        >
          Reiniciar
        </Button>
      </div>

      <section className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold">Buscador</h1>
        <p className="text-sm text-muted-foreground">
          Encontrá jugadores y partidas. Los filtros quedan en la URL, así podés
          compartir la búsqueda.
        </p>
      </section>

      <AdvancedSearch
        search={search}
        vip={vip}
        onChange={(patch) =>
          void navigate({
            search: (prev) => ({ ...prev, ...patch }),
            replace: true,
          })
        }
      />
    </div>
  )
}
