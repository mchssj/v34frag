import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  DEFAULT_POOL,
  DEMO_FLAGS,
  DEMO_FRIENDS,
  DEMO_MAPS,
  DEMO_ME,
  DEMO_TEAMS,
  MY_TEAM,
  PLANTEL,
  mapImage,
  usePcwDemo,
  type PcwDemo,
} from "@/features/pcw/demo"
import { demoRoomSource } from "@/features/pcw/demoRoom"
import { sideName } from "@/features/pcw/lib/pcw"
import type { PcwModel } from "@/features/pcw/model"
import { PcwPage } from "@/features/pcw/pages/PcwPage"
import { PcwRoom } from "@/features/pcw/pages/PcwRoom"
import { VipDialog } from "@/features/vip/VipDialog"

// Ejemplo de la página de PCW sin API ni sesión (docs/bitacora/2026-11-08-pcw-demo). Solo en
// `pnpm dev`: en el build de producción la ruta no existe. Muestra también las ideas que todavía no tienen backend.
export const Route = createFileRoute("/demo/pcw")({
  // ?sala=<id>: la sala de una PCW con los dos listos, como página aparte.
  validateSearch: (s: Record<string, unknown>): { sala?: string } =>
    typeof s.sala === "string" ? { sala: s.sala } : {},
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoPcw,
})

/** El modelo de la página con el estado de la demo. */
function demoModel(demo: PcwDemo, onVip: () => void): PcwModel {
  return {
    ...demo,
    me: DEMO_ME,
    myTeam: MY_TEAM,
    plantel: PLANTEL(),
    friends: DEMO_FRIENDS,
    teams: DEMO_TEAMS,
    maps: DEMO_MAPS,
    defaultPool: DEFAULT_POOL,
    mapImage,
    isVip: !demo.flags.notVip,
    onVipRequired: () => {
      toast.error(
        "Publicar una PCW es para VIP. Sin serlo, podés mandar ofertas a los anuncios del tablón.",
        { action: { label: "Hacete VIP", onClick: onVip } }
      )
    },
    features: {
      subs: true,
      alerts: true,
      invite: true,
      discord: true,
      demoBell: true,
    },
    renderRoom: (m, onBack, onRoom) => (
      <PcwRoom
        key={m.id}
        m={m}
        onBack={onBack}
        series={{
          onRoom,
          onVeto: demo.veto,
          onUnready: demo.unready,
          onFinishMap: demo.finishMap,
          onDismiss: demo.dismissSeries,
        }}
        meId={DEMO_ME.id}
        mapImage={mapImage}
        source={demoRoomSource(
          m.id,
          m.them.roster[0]?.alias ?? sideName(m.them),
          demo.veto
        )}
        simulate
      />
    ),
  }
}

function DemoPcw() {
  const demo = usePcwDemo()
  const [vip, setVip] = useState(false)
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
        model={demoModel(demo, () => setVip(true))}
        room={sala}
        onRoom={(id) => {
          void navigate({ search: id ? { sala: id } : {} })
          window.scrollTo({ top: 0 })
        }}
      />
      <VipDialog open={vip} onOpenChange={setVip} />
    </div>
  )
}
