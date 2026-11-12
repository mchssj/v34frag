import { createFileRoute, notFound } from "@tanstack/react-router"

import { AdminMedalsDemo } from "@/features/medals/pages/AdminMedalsDemo"

// Demo de Administración › Medallas con datos en memoria (docs/bitacora/2026-11-03-medallas-en-la-web).
// Solo en `pnpm dev`: en el build de producción la ruta no existe.
export const Route = createFileRoute("/demo/admin-medallas")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: () => (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        <span className="text-xs text-muted-foreground">
          Jugadores y temporadas de ejemplo. Nada se guarda: al recargar vuelve
          a empezar.
        </span>
      </div>
      <AdminMedalsDemo />
    </div>
  ),
})
