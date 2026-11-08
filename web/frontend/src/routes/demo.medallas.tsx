import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Medal } from "@/features/medals/Medal"
import { CATEGORIES, TEMPLATES, defaultLook } from "@/features/medals/templates"

// Todas las plantillas de medallas con su dibujo por defecto, desbloqueadas o bloqueadas (plan
// docs/bitacora/2026-11-04-medallas-configurables, paso 3). Solo en `pnpm dev`: en producción la ruta no existe.
export const Route = createFileRoute("/demo/medallas")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoMedallas,
})

function DemoMedallas() {
  const [locked, setLocked] = useState(false)
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Plantillas de medallas ({TEMPLATES.length})
        </h1>
        <div className="flex items-center gap-2">
          <Switch id="bloq" checked={locked} onCheckedChange={setLocked} />
          <Label htmlFor="bloq">Bloqueadas</Label>
        </div>
      </header>
      {CATEGORIES.map((cat) => (
        <section key={cat} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{cat}</h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
            {TEMPLATES.filter((t) => t.category === cat).map((t) => (
              <li
                key={t.id}
                className="flex flex-col items-center gap-1 text-center text-xs"
              >
                <Medal
                  look={defaultLook(t)}
                  locked={locked}
                  size={120}
                  title={t.title}
                />
                <span className="font-medium">{t.title}</span>
                <span className="font-mono text-muted-foreground">{t.id}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
