import { useQuery } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { AdminHeader, AdminTabs, StatTile } from "../ui"
import { AdjustmentsTab } from "./AdjustmentsTab"
import { DemosTab } from "./DemosTab"
import { EloRulesTab } from "./EloRulesTab"
import {
  demoSummaryOptions,
  pendingMixesOptions,
  serversOptions,
  staleMixesOptions,
} from "./queries"
import { ReviewTab } from "./ReviewTab"
import { ServersTab } from "./ServersTab"

export const SERVER_TABS = [
  "servers",
  "demos",
  "elo",
  "adjustments",
  "review",
] as const
export type ServerTab = (typeof SERVER_TABS)[number]

export function AdminServersPage({
  tab,
  onTab,
}: {
  tab: ServerTab
  onTab: (t: ServerTab) => void
}) {
  const servers = useQuery(serversOptions)
  const demos = useQuery(demoSummaryOptions)
  const pending = useQuery(pendingMixesOptions)
  const stale = useQuery(staleMixesOptions)
  const [creating, setCreating] = useState(false)

  const active = (servers.data?.items ?? []).filter((s) => s.active)
  const offline = active.filter((s) => !s.online)
  const expiring = active.filter(
    (s) => s.license_state === "expiring" || s.license_state === "expired"
  )
  const d = demos.data
  const reviewN = (pending.data?.total ?? 0) + (stale.data?.total ?? 0)

  return (
    <section className="flex flex-col gap-5">
      <AdminHeader
        title="Servidores y ELO"
        subtitle="Quién puede subir partidas, cómo están las demos y con qué reglas se mueve el ELO."
        action={
          <Button
            size="md"
            onClick={() => {
              onTab("servers")
              setCreating(true)
            }}
          >
            <PlusIcon aria-hidden />
            Nuevo servidor
          </Button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <StatTile
          label="Servidores en línea"
          value={
            servers.data
              ? `${active.length - offline.length} de ${active.length}`
              : "—"
          }
          sub={
            offline.length
              ? `${offline.map((s) => s.name).join(", ")} sin señal`
              : "Todos validando su licencia"
          }
          warn={offline.length > 0}
          onClick={() => onTab("servers")}
        />
        <StatTile
          label="Licencias"
          value={expiring.length ? `${expiring.length} por vencer` : "Al día"}
          sub={
            expiring.length
              ? expiring.map((s) => s.name).join(", ")
              : "Ninguna vence esta semana"
          }
          warn={expiring.length > 0}
          onClick={() => onTab("servers")}
        />
        <StatTile
          label="Demos"
          value={d ? `${d.pending} pendientes` : "—"}
          sub={
            d
              ? `${d.worker_online ? "Worker en línea" : "Worker detenido"} · ${d.missing} perdidas`
              : "Cargando…"
          }
          warn={!!d && (!d.worker_online || d.missing > 0)}
          onClick={() => onTab("demos")}
        />
        <StatTile
          label="Por revisar"
          value={String(reviewN)}
          sub={`${pending.data?.total ?? 0} interrumpidos · ${stale.data?.total ?? 0} sin señal`}
          warn={reviewN > 0}
          onClick={() => onTab("review")}
        />
      </div>

      <AdminTabs
        label="Secciones de Servidores y ELO"
        value={tab}
        onChange={onTab}
        tabs={[
          { key: "servers", label: "Servidores" },
          { key: "demos", label: "Demos", badge: d?.missing },
          { key: "elo", label: "Reglas del ELO" },
          { key: "adjustments", label: "Ajustes manuales" },
          { key: "review", label: "Mixes por revisar", badge: reviewN },
        ]}
      />

      {tab === "servers" && (
        <ServersTab
          creating={creating}
          onCreatingDone={() => setCreating(false)}
        />
      )}
      {tab === "demos" && <DemosTab />}
      {tab === "elo" && <EloRulesTab />}
      {tab === "adjustments" && <AdjustmentsTab />}
      {tab === "review" && <ReviewTab />}
    </section>
  )
}
