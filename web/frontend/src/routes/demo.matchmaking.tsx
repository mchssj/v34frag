import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AdminMatchmaking } from "@/features/matchmaking/admin/AdminMatchmaking"
import { createDemoSource, type DemoFlag } from "@/features/matchmaking/demo"
import {
  GlobalMatchAlerts,
  SearchingPill,
} from "@/features/matchmaking/MatchAlerts"
import { PlayPage } from "@/features/matchmaking/PlayPage"
import { ReconnectBanner } from "@/features/matchmaking/ReconnectBanner"
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
  const [view, setView] = useState<"player" | "other" | "admin">("player")
  return (
    <QueryClientProvider client={queryClient}>
      <MmSourceContext value={source}>
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 p-6">
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
            <Button size="sm" variant="outline" onClick={controls.closeWeb}>
              Cerrar la web buscando
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
              onClick={controls.partnerWrites}
            >
              El compañero escribe
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={controls.partnerLeavesParty}
            >
              El compañero sale del grupo
            </Button>
            <Button size="sm" variant="outline" onClick={controls.meLeaves}>
              Me desconecto / vuelvo
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={controls.friendSearches}
            >
              Un amigo busca partida
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
              {(["player", "other", "admin"] as const).map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant={view === v ? "secondary" : "ghost"}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                >
                  {v === "player"
                    ? "Jugador"
                    : v === "other"
                      ? "Otra pantalla"
                      : "Administración"}
                </Button>
              ))}
            </span>
          </div>
          <ReconnectBanner />
          {view === "player" ? (
            <PlayPage />
          ) : view === "other" ? (
            <OtherScreen />
          ) : (
            <AdminMatchmaking />
          )}
          {/* Fuera de Jugar, como en el layout de la web: el aviso para aceptar y "Buscando" arriba. */}
          <GlobalMatchAlerts away={view !== "player"} />
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
  { flag: "noAgent", label: "Sin anticheat" },
  { flag: "notVip", label: "Sin VIP" },
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

/** "Otra pantalla" de la demo: así se ve la barra de arriba con la cola fuera de Jugar. */
function OtherScreen() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-[52px] items-center gap-2 rounded-xl border px-3">
        <span className="flex-1 text-sm text-muted-foreground">
          Barra de arriba (en cualquier página fuera de Jugar)
        </span>
        <SearchingPill away />
      </div>
      <p className="text-sm text-muted-foreground">
        Otra página de la web (Ranking, Partidas, un perfil…). Entrá a la cola
        en Jugar y volvé acá: arriba se ve &quot;Buscando&quot; con el tiempo, y
        cuando se arma la partida salta la ventana para aceptar.
      </p>
    </div>
  )
}
