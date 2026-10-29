import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AdminMissions } from "@/features/missions/AdminMissions"
import { useMissionsDemo } from "@/features/missions/demo"
import { MissionsPage, MissionsPopout } from "@/features/missions/MissionsUi"

// Ejemplo de las misiones semanales sin API ni sesión (docs/bitacora/2026-10-29-misiones-semanales en
// kyan/pruebas). Solo en `pnpm dev`: en el build de producción la ruta no existe.
export const Route = createFileRoute("/demo/misiones")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoMisiones,
})

const VIEWS = { page: "Página de misiones", admin: "Admin → Misiones" } as const

// Acciones de la web que suman a las misiones (en la versión real, eventos de la API).
const WEB_ACTIONS: { label: string; metric: string }[] = [
  { label: "Entrar a la web otro día", metric: "login_days" },
  { label: "Votar un clip", metric: "clips_voted" },
  { label: "Subir un clip", metric: "clips_uploaded" },
  { label: "Mirar una demo", metric: "demos_watched" },
  { label: "Comparar", metric: "compares" },
  { label: "Buscar con filtros", metric: "searches" },
  { label: "Comprar en la tienda", metric: "shop_purchases" },
  { label: "Equipar un cosmético", metric: "cosmetics_equipped" },
  { label: "Exportar stats", metric: "stats_exported" },
  { label: "Anotarse a un evento", metric: "event_signups" },
  { label: "Jugar un PCW", metric: "pcw_played" },
]

function DemoMisiones() {
  const d = useMissionsDemo()
  const [view, setView] = useState<keyof typeof VIEWS>("page")
  const play = (won: boolean) => {
    const r = d.playMix(won)
    toast.success(
      `Mix ${won ? "ganado" : "perdido"} en ${r.map}: ${r.kills} kills, rating ${r.rating.toFixed(2)}.`
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 rounded-xl border border-dashed p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
            Demo
          </span>
          <Button size="sm" variant="outline" onClick={() => play(true)}>
            Ganar un mix
          </Button>
          <Button size="sm" variant="outline" onClick={() => play(false)}>
            Perder un mix
          </Button>
          <Button size="sm" variant="outline" onClick={d.nextWeek}>
            Pasar a la semana siguiente
          </Button>
          <span className="inline-flex items-center gap-1.5">
            <Switch
              id="demo-vip"
              size="sm"
              checked={d.vip}
              onCheckedChange={d.setVip}
            />
            <Label htmlFor="demo-vip" className="text-xs">
              Ser VIP
            </Label>
          </span>
          <Button size="sm" variant="ghost" onClick={d.reset}>
            Reiniciar
          </Button>
          <span className="ml-auto inline-flex rounded-lg border p-0.5">
            {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={view === v ? "secondary" : "ghost"}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {VIEWS[v]}
              </Button>
            ))}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">En la web:</span>
          {WEB_ACTIONS.map((a) => (
            <Button
              key={a.metric}
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => d.add(a.metric)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </div>

      {/* La barra de arriba de la web, con el botón del popout. */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-2.5">
        <span className="text-sm text-muted-foreground">
          Barra de arriba de la web →
        </span>
        <MissionsPopout d={d} onOpenPage={() => setView("page")} />
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.4px]">
          {view === "page" ? "Misiones" : "Misiones (admin)"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {view === "page"
            ? "Cada lunes salen misiones nuevas, de juego y de la web. Completalas para ganar puntos de la tienda y, con VIP, monedas VIP."
            : "El catálogo y la rotación. Una misión que salió no vuelve hasta dentro de 2 semanas."}
        </p>
      </div>
      {view === "page" ? (
        <MissionsPage d={d} />
      ) : (
        <AdminMissions fromWeek={d.week} />
      )}
    </div>
  )
}
