import { createFileRoute, notFound } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { DEMO_FLAGS, usePcwDemo } from "@/features/pcw/demo"
import { PcwPage } from "@/features/pcw/pages/PcwPage"

// Ejemplo de la página de PCW sin API ni sesión (docs/bitacora/2026-11-08-pcw-demo). Solo en
// `pnpm dev`: en el build de producción la ruta no existe.
export const Route = createFileRoute("/demo/pcw")({
  // ?sala=<id>: la sala de una PCW con los dos listos, como página aparte.
  validateSearch: (s: Record<string, unknown>): { sala?: string } =>
    typeof s.sala === "string" ? { sala: s.sala } : {},
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoPcw,
})

function DemoPcw() {
  const demo = usePcwDemo()
  const { sala } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        {DEMO_FLAGS.map((f) => (
          <span key={f.flag} className="inline-flex items-center gap-2">
            <Switch
              id={`flag-${f.flag}`}
              checked={demo.flags[f.flag]}
              onCheckedChange={(on) => demo.setFlag(f.flag, on)}
            />
            <Label htmlFor={`flag-${f.flag}`} className="text-[13px]">
              {f.label}
            </Label>
          </span>
        ))}
        <Button size="sm" variant="outline" onClick={demo.rush}>
          Adelantar la espera
        </Button>
      </div>
      <PcwPage
        demo={demo}
        room={sala}
        onRoom={(id) => {
          void navigate({ search: id ? { sala: id } : {} })
          window.scrollTo({ top: 0 })
        }}
      />
    </div>
  )
}
