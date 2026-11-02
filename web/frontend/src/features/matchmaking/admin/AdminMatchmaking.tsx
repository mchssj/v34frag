import { useState } from "react"

import { AdminHeader, AdminTabs } from "@/features/admin/components/ui"
import { GeneralForm } from "./GeneralForm"
import { LobbiesPanel } from "./LobbiesPanel"
import { MapsPanel } from "./MapsPanel"
import { SoundsPanel } from "./SoundsPanel"
import { ReportsPanel } from "./ReportsPanel"
import { ServerPasswords } from "./ServerPasswords"
import { StatsPanel } from "./StatsPanel"

// Administración › Matchmaking (plan, sección 7): todo lo del matchmaking, en seis pestañas.

const TABS = [
  { key: "general", label: "General" },
  { key: "maps", label: "Mapas" },
  { key: "sounds", label: "Sonidos" },
  { key: "servers", label: "Servidores" },
  { key: "lobbies", label: "Salas" },
  { key: "reports", label: "Reportes" },
  { key: "stats", label: "Métricas" },
] as const

type Tab = (typeof TABS)[number]["key"]

export function AdminMatchmaking() {
  const [tab, setTab] = useState<Tab>("general")
  return (
    <section className="flex flex-col gap-5">
      <AdminHeader
        title="Matchmaking"
        subtitle="La cola, los mapas y los sonidos de Jugar, las contraseñas de los servidores, las salas en curso, los reportes y las métricas."
      />
      <AdminTabs
        label="Secciones del matchmaking"
        value={tab}
        onChange={setTab}
        tabs={[...TABS]}
      />
      <div>
        {tab === "general" && <GeneralForm />}
        {tab === "maps" && <MapsPanel />}
        {tab === "sounds" && <SoundsPanel />}
        {tab === "servers" && <ServerPasswords />}
        {tab === "lobbies" && <LobbiesPanel />}
        {tab === "reports" && <ReportsPanel />}
        {tab === "stats" && <StatsPanel />}
      </div>
    </section>
  )
}
