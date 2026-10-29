import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AdminMatchmaking } from "@/features/matchmaking/admin/AdminMatchmaking"
import { createDemoSource, type DemoFlag } from "@/features/matchmaking/demo"
import { PlayPage } from "@/features/matchmaking/PlayPage"
import { MmSourceContext } from "@/features/matchmaking/source"

// Ejemplo del matchmaking sin API ni sesión (plan docs/bitacora/2026-10-28-matchmaking). Solo en
// `pnpm dev`: en el build de producción la ruta no existe.
export const Route = createFileRoute("/demo/matchmaking")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoMatchmaking,
})

function DemoMatchmaking() {
  // Cache aparte: no se mezcla con los datos reales de la app.
  const [queryClient] = useState(() => new QueryClient())
  const [{ source, controls }] = useState(() => createDemoSource())
  const [view, setView] = useState<"player" | "admin">("player")
  return (
    <QueryClientProvider client={queryClient}>
      <MmSourceContext value={source}>
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
            <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
              Demo
            </span>
            <Button size="sm" variant="outline" onClick={controls.skip}>
              Siguiente paso
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={controls.someoneDeclines}
            >
              Otro jugador rechaza
            </Button>
            <Button size="sm" variant="outline" onClick={controls.finish}>
              Terminar el mix
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={controls.receiveInvite}
            >
              Recibir invitación
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={controls.teammateLeaves}
            >
              Un compañero se desconecta
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={controls.partnerLeavesParty}
            >
              El compañero sale del grupo
            </Button>
            {FLAGS.map((f) => (
              <FlagSwitch
                key={f.flag}
                flag={f.flag}
                label={f.label}
                initial={f.flag === "captain"}
                onChange={controls.setFlag}
              />
            ))}
            <Button size="sm" variant="ghost" onClick={controls.reset}>
              Reiniciar
            </Button>
            <span className="ml-auto inline-flex rounded-lg border p-0.5">
              {(["player", "admin"] as const).map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant={view === v ? "secondary" : "ghost"}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                >
                  {v === "player" ? "Jugador" : "Administración"}
                </Button>
              ))}
            </span>
          </div>
          {view === "player" ? <PlayPage /> : <AdminMatchmaking />}
        </div>
      </MmSourceContext>
    </QueryClientProvider>
  )
}

const FLAGS: { flag: DemoFlag; label: string }[] = [
  { flag: "captain", label: "Ser capitán" },
  { flag: "newcomer", label: "Cuenta nueva" },
  { flag: "serversBusy", label: "Servidores ocupados" },
  { flag: "season", label: "Cierre de temporada" },
]

function FlagSwitch({
  flag,
  label,
  initial,
  onChange,
}: {
  flag: DemoFlag
  label: string
  initial: boolean
  onChange: (flag: DemoFlag, on: boolean) => void
}) {
  const [on, setOn] = useState(initial)
  const id = `demo-${flag}`
  return (
    <span className="inline-flex items-center gap-1.5">
      <Switch
        id={id}
        size="sm"
        checked={on}
        onCheckedChange={(v) => {
          setOn(v)
          onChange(flag, v)
        }}
      />
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
    </span>
  )
}
